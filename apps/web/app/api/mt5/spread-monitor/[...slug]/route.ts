import type { NextRequest } from "next/server";

import { failure, ok } from "../../_lib/http";
import {
  aiDiagnostics,
  alerts,
  autoRemediate,
  brokerComparison,
  createThreshold,
  diagnostics,
  disableExecution,
  enableExecution,
  logs,
  spreads,
  spreadMonitorRole,
  summary,
  symbolDetail,
  thresholds,
  trends,
  updateThreshold
} from "../_lib/store";

export const dynamic = "force-dynamic";

function notFound() {
  throw new Error("not found");
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = spreadMonitorRole(request);
  const url = new URL(request.url);

  try {
    if (slug[0] === "events-stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = () => {
            const payload = {
              summary: summary(role),
              spreads: spreads({ page: 1, pageSize: 75 }),
              thresholds: thresholds(),
              alerts: alerts("unresolved")
            };
            controller.enqueue(encoder.encode(`event: spread-monitor-snapshot\ndata: ${JSON.stringify(payload)}\n\n`));
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
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" }
      });
    }

    if (slug[0] === "summary") return ok(summary(role));
    if (slug[0] === "spreads") {
      const search = url.searchParams.get("search") ?? undefined;
      const assetClass = url.searchParams.get("assetClass") ?? undefined;
      const status = url.searchParams.get("status") ?? undefined;
      const brokerId = url.searchParams.get("brokerId") ?? undefined;
      const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
      const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;
      return ok(spreads({ search, assetClass, status, brokerId, page, pageSize }));
    }
    if (slug[0] === "symbols" && slug.length === 2) return ok(symbolDetail(slug[1]!));
    if (slug[0] === "broker-comparison") return ok(brokerComparison());
    if (slug[0] === "trends") return ok(trends());
    if (slug[0] === "thresholds" && slug.length === 1) return ok(thresholds());
    if (slug[0] === "alerts") return ok(alerts(url.searchParams.get("filter") ?? undefined));
    if (slug[0] === "logs") return ok(logs(url.searchParams.get("filter") ?? undefined));
    if (slug[0] === "ai-diagnostics") return ok(aiDiagnostics());

    return notFound();
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = spreadMonitorRole(request);

  try {
    if (slug[0] === "diagnostics") return ok(diagnostics(role, request));
    if (slug[0] === "auto-remediate") return ok(autoRemediate(role, request));
    if (slug[0] === "thresholds" && slug.length === 1) {
      const payload = (await request.json()) as any;
      return ok(createThreshold(payload, role, request));
    }
    if (slug[0] === "symbols" && slug.length === 3) {
      const symbol = slug[1]!;
      const action = slug[2]!;
      if (action === "disable-execution") return ok(disableExecution(symbol, role, request));
      if (action === "enable-execution") return ok(enableExecution(symbol, role, request));
      return notFound();
    }
    return notFound();
  } catch (e) {
    return failure(e);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = spreadMonitorRole(request);

  try {
    if (slug[0] === "thresholds" && slug.length === 2) {
      const thresholdId = slug[1]!;
      const patch = (await request.json()) as any;
      return ok(updateThreshold(thresholdId, patch, role, request));
    }
    return notFound();
  } catch (e) {
    return failure(e);
  }
}

