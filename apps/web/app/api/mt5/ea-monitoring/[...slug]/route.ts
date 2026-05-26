import type { NextRequest } from "next/server";

import { failure, ok } from "../../_lib/http";
import {
  aiDiagnostics,
  analytics,
  auditTrail,
  autoRemediate,
  commands,
  diagnostics,
  disableTrading,
  eaMonitoringRole,
  enableTrading,
  exceptions,
  exportReport,
  instanceDetail,
  listInstances,
  logs,
  rebindStrategy,
  rebindTerminal,
  restart,
  summary,
  sync,
  strategyBindings,
  workflow
} from "../_lib/store";

export const dynamic = "force-dynamic";

function notFound() {
  throw new Error("not found");
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = eaMonitoringRole(request);
  const url = new URL(request.url);

  try {
    if (slug[0] === "events-stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = () => {
            const payload = { summary: summary(role) };
            controller.enqueue(encoder.encode(`event: ea-monitoring-snapshot\ndata: ${JSON.stringify(payload)}\n\n`));
          };
          send();
          const interval = setInterval(send, 6000);
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
    if (slug[0] === "workflow") return ok(workflow());
    if (slug[0] === "strategy-bindings") return ok(strategyBindings());
    if (slug[0] === "logs") return ok(logs(url.searchParams.get("filter") ?? undefined));
    if (slug[0] === "exceptions") return ok(exceptions(url.searchParams.get("filter") ?? undefined));
    if (slug[0] === "analytics") return ok(analytics());
    if (slug[0] === "ai-diagnostics") return ok(aiDiagnostics());
    if (slug[0] === "audit") return ok(auditTrail());

    if (slug[0] === "instances") {
      if (slug.length === 1) {
        const search = url.searchParams.get("search") ?? undefined;
        const status = url.searchParams.get("status") ?? undefined;
        const risk = url.searchParams.get("risk") ?? undefined;
        const trading = url.searchParams.get("trading") ?? undefined;
        const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
        const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;
        return ok(listInstances({ search, status, risk, trading, page, pageSize }));
      }
      if (slug.length === 2) return ok(instanceDetail(slug[1]!));
    }

    if (slug[0] === "commands") {
      const search = url.searchParams.get("search") ?? undefined;
      const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
      const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;
      return ok(commands({ search, page, pageSize }));
    }

    return notFound();
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = eaMonitoringRole(request);

  try {
    if (slug[0] === "sync") return ok(sync(role, request));
    if (slug[0] === "diagnostics") return ok(diagnostics(role, null, request));

    if (slug[0] === "auto-remediate") {
      const body = (await request.json().catch(() => ({}))) as any;
      return ok(autoRemediate(role, String(body.eaId), request));
    }

    if (slug[0] === "export") {
      const payload = (await request.json()) as any;
      return ok(exportReport(payload, role, request));
    }

    if (slug[0] === "instances" && slug.length >= 3) {
      const eaId = slug[1]!;
      const action = slug[2]!;

      if (action === "restart") return ok(restart(role, eaId, request));
      if (action === "diagnostics") return ok(diagnostics(role, eaId, request));
      if (action === "disable-trading") return ok(disableTrading(role, eaId, request));
      if (action === "enable-trading") return ok(enableTrading(role, eaId, request));
      if (action === "rebind-strategy") {
        const payload = (await request.json().catch(() => ({}))) as any;
        return ok(rebindStrategy(role, eaId, payload, request));
      }
      if (action === "rebind-terminal") {
        const payload = (await request.json().catch(() => ({}))) as any;
        return ok(rebindTerminal(role, eaId, payload, request));
      }
    }

    return notFound();
  } catch (e) {
    return failure(e);
  }
}
