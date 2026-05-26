import type { NextRequest } from "next/server";

import { failure, ok } from "../../_lib/http";
import {
  buildEaTerminalHubResponse,
  connectTerminals,
  disconnectTerminals,
  eaTerminalHubRole,
  linkTerminalFolder,
  previewTerminalSync,
  registerTerminal,
  scanFolders,
  setActiveTerminal,
  summary,
  syncAllTerminalFolders,
  toggleAutoLink
} from "../_lib/store";

export const dynamic = "force-dynamic";

function notFound() {
  throw new Error("not found");
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = eaTerminalHubRole(request);

  try {
    if (slug[0] === "events-stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = () => {
            void buildEaTerminalHubResponse(role).then((payload) => {
              controller.enqueue(encoder.encode(`event: ea-terminal-hub-snapshot\ndata: ${JSON.stringify(payload)}\n\n`));
            });
          };
          send();
          const interval = setInterval(send, 8000);
          request.signal.addEventListener("abort", () => {
            clearInterval(interval);
            controller.close();
          });
        }
      });
      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive"
        }
      });
    }

    if (slug[0] === "summary") return ok(summary(role));
    if (slug[0] === "preview-sync" && slug[1]) return ok(await previewTerminalSync(slug[1], role));
    if (!slug.length) return ok(await buildEaTerminalHubResponse(role));
    notFound();
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = eaTerminalHubRole(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (slug[0] === "scan") return ok(await scanFolders(role, request));
    if (slug[0] === "connect") {
      return ok(
        await connectTerminals(
          {
            terminalIds: (body.terminalIds as string[]) ?? [],
            confirmed: Boolean(body.confirmed),
            autoLink: body.autoLink === undefined ? true : Boolean(body.autoLink)
          },
          role,
          request
        )
      );
    }
    if (slug[0] === "disconnect") {
      return ok(disconnectTerminals((body.terminalIds as string[]) ?? [], role, Boolean(body.confirmed), request));
    }
    if (slug[0] === "link") {
      return ok(
        await linkTerminalFolder(
          {
            terminalId: String(body.terminalId ?? ""),
            confirmed: Boolean(body.confirmed),
            mt5DataPath: body.mt5DataPath ? String(body.mt5DataPath) : undefined,
            fileNames: body.fileNames as string[] | undefined,
            relativePaths: body.relativePaths as string[] | undefined
          },
          role,
          request
        )
      );
    }
    if (slug[0] === "preview-sync") {
      return ok(await previewTerminalSync(String(body.terminalId ?? ""), role));
    }
    if (slug[0] === "set-active") return ok(await setActiveTerminal(String(body.terminalId ?? ""), role, request));
    if (slug[0] === "sync-all") return ok(await syncAllTerminalFolders(role, Boolean(body.confirmed), request));
    if (slug[0] === "toggle-auto-link") {
      return ok(toggleAutoLink(String(body.terminalId ?? ""), Boolean(body.enabled), role, request));
    }
    if (slug[0] === "register-terminal") {
      return ok(
        registerTerminal(
          {
            terminalName: String(body.terminalName ?? "Custom Terminal"),
            terminalExecutablePath: String(body.terminalExecutablePath ?? ""),
            mt5DataPath: body.mt5DataPath ? String(body.mt5DataPath) : undefined,
            brokerName: String(body.brokerName ?? "Unassigned"),
            accountLogin: String(body.accountLogin ?? "00000000"),
            hostMachine: String(body.hostMachine ?? "LOCAL"),
            region: String(body.region ?? "Local")
          },
          role,
          request
        )
      );
    }
    notFound();
  } catch (error) {
    return failure(error);
  }
}
