import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { EaFolderFile, SyncPreviewItem } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/types/ea-terminal-hub.types";
import { buildSyncPreview } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/algorithms/ea-terminal-hub.algorithms";

import { deriveMt5IncludePathFromExperts, resolveCacsmsEaRoot, resolveRepoBridgeEaSourceCandidates, toPosixRelative } from "./paths";

const EA_EXTENSIONS = new Set([".mq5", ".mq4", ".ex5", ".ex4", ".mqh"]);
const MAX_HASH_BYTES = 8 * 1024 * 1024;

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function hashFile(absolutePath: string) {
  const stat = await fs.stat(absolutePath);
  if (stat.size > MAX_HASH_BYTES) return null;
  const buffer = await fs.readFile(absolutePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function walkEaFiles(root: string, relative = ""): Promise<EaFolderFile[]> {
  const absolute = path.join(root, relative);
  if (!(await pathExists(absolute))) return [];

  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const files: EaFolderFile[] = [];

  for (const entry of entries) {
    const entryRelative = relative ? path.join(relative, entry.name) : entry.name;
    const entryAbsolute = path.join(root, entryRelative);
    if (entry.isDirectory()) {
      files.push(...(await walkEaFiles(root, entryRelative)));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!EA_EXTENSIONS.has(ext)) continue;
    const stat = await fs.stat(entryAbsolute);
    files.push({
      name: entry.name,
      relativePath: toPosixRelative(entryRelative),
      extension: ext,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      contentHash: await hashFile(entryAbsolute)
    });
  }

  return files;
}

async function ensureDirectoryTree(target: string) {
  await fs.mkdir(target, { recursive: true });
}

export async function validateTerminalExecutable(terminalExecutablePath: string) {
  const normalized = path.resolve(terminalExecutablePath);
  if (!(await pathExists(normalized))) {
    throw new Error(`Terminal executable not found at ${normalized}. Verify the MT5 installation path.`);
  }
  const stat = await fs.stat(normalized);
  if (!stat.isFile()) throw new Error("Terminal executable path must reference a file.");
}

export async function ensureNexusBridgeEaBootstrap() {
  const expertsDir = path.join(resolveCacsmsEaRoot(), "Experts");
  await ensureDirectoryTree(expertsDir);
  const target = path.join(expertsDir, "NexusBridgeEA.mq5");
  if (await pathExists(target)) return false;

  const source = (await Promise.all(resolveRepoBridgeEaSourceCandidates().map(async (candidate) => ((await pathExists(candidate)) ? candidate : null)))).find(Boolean);
  if (!source) {
    return false;
  }

  await fs.copyFile(source, target);
  return true;
}

export async function scanCacsmsEaFolder() {
  await ensureNexusBridgeEaBootstrap();

  const root = resolveCacsmsEaRoot();
  const exists = await pathExists(root);
  if (!exists) {
    await ensureDirectoryTree(root);
    await ensureDirectoryTree(path.join(root, "Experts"));
    await ensureDirectoryTree(path.join(root, "Include"));
  }

  const expertsDir = path.join(root, "Experts");
  const includeDir = path.join(root, "Include");
  const expertsExists = await pathExists(expertsDir);
  const scanRoot = expertsExists ? expertsDir : root;
  const files = await walkEaFiles(scanRoot);
  const includeFiles = (await pathExists(includeDir)) ? await walkEaFiles(includeDir) : [];
  const stat = await fs.stat(scanRoot);

  return {
    root,
    expertsPath: scanRoot,
    includePath: (await pathExists(includeDir)) ? includeDir : null,
    exists: true,
    files: [...files, ...includeFiles.map((file) => ({ ...file, relativePath: `Include/${file.relativePath}` }))],
    fileCount: files.length + includeFiles.length,
    lastScannedAt: new Date().toISOString(),
    lastModifiedAt: stat.mtime.toISOString()
  };
}

export async function scanMt5ExpertsFolder(mt5ExpertsPath: string) {
  const mt5IncludePath = deriveMt5IncludePathFromExperts(mt5ExpertsPath);
  const exists = await pathExists(mt5ExpertsPath);
  if (!exists) {
    return {
      path: mt5ExpertsPath,
      includePath: mt5IncludePath,
      exists: false,
      files: [] as EaFolderFile[],
      fileCount: 0,
      lastScannedAt: new Date().toISOString(),
      lastModifiedAt: null as string | null
    };
  }

  const expertFiles = await walkEaFiles(mt5ExpertsPath);
  const includeFiles = (await pathExists(mt5IncludePath)) ? await walkEaFiles(mt5IncludePath) : [];
  const stat = await fs.stat(mt5ExpertsPath);
  return {
    path: mt5ExpertsPath,
    includePath: mt5IncludePath,
    exists: true,
    files: [...expertFiles, ...includeFiles.map((file) => ({ ...file, relativePath: `Include/${file.relativePath}` }))],
    fileCount: expertFiles.length + includeFiles.length,
    lastScannedAt: new Date().toISOString(),
    lastModifiedAt: stat.mtime.toISOString()
  };
}

async function sourceAbsoluteFor(relativePath: string) {
  const root = resolveCacsmsEaRoot();
  if (relativePath.startsWith("Include/")) {
    return path.join(root, "Include", relativePath.slice("Include/".length));
  }
  const expertsDir = path.join(root, "Experts");
  const expertsExists = await pathExists(expertsDir);
  const fromRoot = expertsExists ? expertsDir : root;
  return path.join(fromRoot, relativePath);
}

async function targetAbsoluteFor(mt5ExpertsPath: string, relativePath: string) {
  const mt5Root = path.dirname(path.dirname(mt5ExpertsPath));
  if (relativePath.startsWith("Include/")) {
    return path.join(mt5Root, "Include", relativePath.slice("Include/".length));
  }
  return path.join(mt5ExpertsPath, relativePath);
}

export async function copyLinkedEaFiles(targetExpertsPath: string, relativePaths: string[]) {
  await ensureDirectoryTree(targetExpertsPath);
  const mt5Root = path.dirname(path.dirname(targetExpertsPath));
  await ensureDirectoryTree(path.join(mt5Root, "Include"));

  const copied: string[] = [];
  for (const relativePath of relativePaths) {
    const source = await sourceAbsoluteFor(relativePath);
    const target = await targetAbsoluteFor(targetExpertsPath, relativePath);
    if (!(await pathExists(source))) continue;
    await ensureDirectoryTree(path.dirname(target));
    await fs.copyFile(source, target);
    copied.push(relativePath);
  }

  return copied;
}

export async function previewLinkedEaSync(targetExpertsPath: string, systemFiles: EaFolderFile[]) {
  const mt5 = await scanMt5ExpertsFolder(targetExpertsPath);
  return buildSyncPreview(systemFiles, mt5.files) satisfies SyncPreviewItem[];
}

export async function copyAllLinkedEaArtifacts(targetExpertsPath: string, systemFiles: EaFolderFile[]) {
  const relativePaths = systemFiles.map((file) => file.relativePath);
  return copyLinkedEaFiles(targetExpertsPath, relativePaths);
}
