import type { NextRequest } from "next/server";

import { failure, ok } from "../../_lib/http";
import { mt5StreamIntervalMs } from "../../_lib/realtime-stream";
import {
  aiDiagnostics,
  alerts,
  autoRemediate,
  brokerComparison,
  createThreshold,
  diagnostics,
  disableUnsafeExecution,
  executionDetail,
  executions,
  logs,
  slippageMonitorRole,
  summary,
  thresholds,
  trends,
  updateThreshold,
  workflow
} from "../_lib/store";

export const dynamic = "force-dynamic";

function notFound() {
  throw new Error("not found");
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = slippageMonitorRole(request);
  const url = new URL(request.url);

  try {
    if (slug[0] === "events-stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = () => {
            const payload = {
              summary: summary(role),
              executions: executions({ page: 1, pageSize: 75 }),
              thresholds: thresholds(),
              alerts: alerts("unresolved")
            };
            controller.enqueue(encoder.encode(`event: slippage-monitor-snapshot\ndata: ${JSON.stringify(payload)}\n\n`));
          };
          send();
          const interval = setInterval(send, mt5StreamIntervalMs());
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
    if (slug[0] === "workflow") return ok(workflow());
    if (slug[0] === "executions") {
      if (slug.length === 2) return ok(executionDetail(slug[1]!));
      const search = url.searchParams.get("search") ?? undefined;
      const assetClass = url.searchParams.get("assetClass") ?? undefined;
      const breach = url.searchParams.get("breach") ?? undefined;
      const brokerId = url.searchParams.get("brokerId") ?? undefined;
      const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
      const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;
      return ok(executions({ search, assetClass, breach, brokerId, page, pageSize }));
    }
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
  const role = slippageMonitorRole(request);

  try {
    if (slug[0] === "diagnostics") return ok(diagnostics(role, request));
    if (slug[0] === "disable-unsafe-execution") return ok(disableUnsafeExecution(role, request));
    if (slug[0] === "auto-remediate") return ok(autoRemediate(role, request));
    if (slug[0] === "thresholds" && slug.length === 1) {
      const payload = (await request.json()) as any;
      return ok(createThreshold(payload, role, request));
    }
    return notFound();
  } catch (e) {
    return failure(e);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = slippageMonitorRole(request);

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
