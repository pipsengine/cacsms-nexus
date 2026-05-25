import type { NextRequest } from "next/server";
import { failure, ok } from "../../_lib/http";
import {
  aiDiagnostics,
  autoRemediate,
  buildSummary,
  componentDetail,
  componentDiagnostics,
  componentReconnect,
  componentRestart,
  connectionHealthRole,
  dependencyMap,
  disableTradingPath,
  disableUnsafeTrading,
  fullDiagnostics,
  heartbeats,
  incidents,
  latency,
  listComponents,
  logs,
  packetLoss,
  reconnectFailed,
  restartUnhealthy,
  workflow
} from "../_lib/store";

export const dynamic = "force-dynamic";

function notFound() {
  throw new Error("not found");
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = connectionHealthRole(request);
  const url = new URL(request.url);

  try {
    if (slug[0] === "events-stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = () => {
            const payload = {
              summary: buildSummary(role),
              components: listComponents({ page: 1, pageSize: 60 })
            };
            controller.enqueue(encoder.encode(`event: connection-health-snapshot\ndata: ${JSON.stringify(payload)}\n\n`));
          };
          send();
          const interval = setInterval(send, 5000);
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

    if (slug[0] === "summary") return ok(buildSummary(role));
    if (slug[0] === "workflow") return ok(workflow());
    if (slug[0] === "dependency-map") return ok(dependencyMap());
    if (slug[0] === "latency") return ok(latency());
    if (slug[0] === "packet-loss") return ok(packetLoss());
    if (slug[0] === "heartbeats") return ok(heartbeats());
    if (slug[0] === "ai-diagnostics") return ok(aiDiagnostics());

    if (slug[0] === "incidents") {
      const filter = url.searchParams.get("filter") ?? undefined;
      return ok(incidents(filter));
    }

    if (slug[0] === "logs") {
      const filter = url.searchParams.get("filter") ?? undefined;
      return ok(logs(filter));
    }

    if (slug[0] === "components") {
      if (slug.length === 1) {
        const search = url.searchParams.get("search") ?? undefined;
        const type = url.searchParams.get("type") ?? undefined;
        const status = url.searchParams.get("status") ?? undefined;
        const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
        const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;
        return ok(listComponents({ search, type, status, page, pageSize }));
      }
      if (slug.length === 2) return ok(componentDetail(slug[1]!));
      return notFound();
    }

    return notFound();
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = connectionHealthRole(request);

  try {
    if (slug[0] === "full-diagnostics") return ok(fullDiagnostics(role, request));
    if (slug[0] === "reconnect-failed") return ok(reconnectFailed(role, request));
    if (slug[0] === "restart-unhealthy") return ok(restartUnhealthy(role, request));
    if (slug[0] === "auto-remediate") return ok(autoRemediate(role, request));
    if (slug[0] === "disable-unsafe-trading") return ok(disableUnsafeTrading(role, request));

    if (slug[0] === "components" && slug.length === 3) {
      const componentId = slug[1]!;
      const action = slug[2]!;
      if (action === "diagnostics") return ok(componentDiagnostics(componentId, role, request));
      if (action === "reconnect") return ok(componentReconnect(componentId, role, request));
      if (action === "restart") return ok(componentRestart(componentId, role, request));
      if (action === "disable-trading-path") return ok(disableTradingPath(componentId, role, request));
      return notFound();
    }

    return notFound();
  } catch (e) {
    return failure(e);
  }
}
