import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import type { EaFolderFile } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/types/ea-terminal-hub.types";

import { resolveCacsmsEaRoot } from "./paths";

const EA_EXTENSIONS = new Set([".mq5", ".mq4", ".ex5", ".ex4", ".mqh"]);

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walkEaFiles(root: string, relative = ""): Promise<EaFolderFile[]> {
  const absolute = path.join(root, relative);
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
      relativePath: entryRelative.replace(/\\/g, "/"),
      extension: ext,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString()
    });
  }

  return files;
}

export async function scanCacsmsEaFolder() {
  const root = resolveCacsmsEaRoot();
  const exists = await pathExists(root);
  if (!exists) {
    await fs.mkdir(root, { recursive: true });
    await fs.mkdir(path.join(root, "Experts"), { recursive: true });
    await fs.mkdir(path.join(root, "Include"), { recursive: true });
  }

  const expertsDir = path.join(root, "Experts");
  const expertsExists = await pathExists(expertsDir);
  const scanRoot = expertsExists ? expertsDir : root;
  const files = await walkEaFiles(scanRoot);
  const stat = await fs.stat(scanRoot);

  return {
    root,
    expertsPath: scanRoot,
    exists: true,
    files,
    fileCount: files.length,
    lastScannedAt: new Date().toISOString(),
    lastModifiedAt: stat.mtime.toISOString()
  };
}

export async function scanMt5ExpertsFolder(mt5ExpertsPath: string) {
  const exists = await pathExists(mt5ExpertsPath);
  if (!exists) {
    return {
      path: mt5ExpertsPath,
      exists: false,
      files: [] as EaFolderFile[],
      fileCount: 0,
      lastScannedAt: new Date().toISOString(),
      lastModifiedAt: null as string | null
    };
  }

  const files = await walkEaFiles(mt5ExpertsPath);
  const stat = await fs.stat(mt5ExpertsPath);
  return {
    path: mt5ExpertsPath,
    exists: true,
    files,
    fileCount: files.length,
    lastScannedAt: new Date().toISOString(),
    lastModifiedAt: stat.mtime.toISOString()
  };
}

export async function copyLinkedEaFiles(targetExpertsPath: string, fileNames: string[]) {
  const sourceRoot = path.join(resolveCacsmsEaRoot(), "Experts");
  const sourceExists = await pathExists(sourceRoot);
  const fallbackRoot = resolveCacsmsEaRoot();
  const fromRoot = sourceExists ? sourceRoot : fallbackRoot;

  await fs.mkdir(targetExpertsPath, { recursive: true });

  const copied: string[] = [];
  for (const fileName of fileNames) {
    const source = path.join(fromRoot, fileName);
    const target = path.join(targetExpertsPath, fileName);
    if (!(await pathExists(source))) continue;
    await fs.copyFile(source, target);
    copied.push(fileName);
  }

  return copied;
}
