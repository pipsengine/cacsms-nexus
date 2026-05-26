import type { NextRequest } from "next/server";

import { failure, ok } from "../../_lib/http";
import {
  aiDiagnostics,
  auditTrail,
  autoRemediate,
  brokerResponse,
  diagnostics,
  exceptions,
  executionLogsRole,
  escalate,
  exportLogs,
  logDetail,
  markReviewed,
  qualityAnalytics,
  refreshDerived,
  retryCancellation,
  summary,
  sync,
  workflow
} from "../_lib/store";

export const dynamic = "force-dynamic";

function notFound() {
  throw new Error("not found");
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = executionLogsRole(request);
  const url = new URL(request.url);

  try {
    if (slug[0] === "events-stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = () => {
            refreshDerived();
            const payload = { summary: summary(role) };
            controller.enqueue(encoder.encode(`event: execution-logs-snapshot\ndata: ${JSON.stringify(payload)}\n\n`));
          };
          send();
          const interval = setInterval(send, 6000);
          request.signal.addEventListener("abort", () => {
            clearInterval(interval);
            controller.close();
          });
        }
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
    }

    if (slug[0] === "summary") return ok(summary(role));
    if (slug[0] === "workflow") return ok(workflow());
    if (slug[0] === "quality-analytics") return ok(qualityAnalytics());
    if (slug[0] === "exceptions") return ok(exceptions(url.searchParams.get("filter") ?? undefined));
    if (slug[0] === "ai-diagnostics") return ok(aiDiagnostics());
    if (slug[0] === "audit") return ok(auditTrail());

    if (slug.length === 1) return ok(logDetail(slug[0]!));
    if (slug.length === 2 && slug[1] === "broker-response") return ok(brokerResponse(slug[0]!));
    if (slug.length === 2 && slug[1] === "retry-cancellation") return ok(retryCancellation(slug[0]!));

    return notFound();
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = executionLogsRole(request);

  try {
    if (slug[0] === "sync") return ok(sync(role, request));
    if (slug[0] === "diagnostics") return ok(diagnostics(role, null, request));
    if (slug[0] === "auto-remediate") {
      const body = (await request.json().catch(() => ({}))) as any;
      return ok(autoRemediate(role, String(body.logId), request));
    }
    if (slug[0] === "export") {
      const payload = (await request.json()) as any;
      return ok(exportLogs(payload, role, request));
    }

    if (slug.length === 2 && slug[1] === "mark-reviewed") {
      const payload = (await request.json().catch(() => ({}))) as any;
      return ok(markReviewed(slug[0]!, payload, role, request));
    }
    if (slug.length === 2 && slug[1] === "escalate") {
      const payload = (await request.json().catch(() => ({}))) as any;
      return ok(escalate(slug[0]!, payload, role, request));
    }
    if (slug.length === 2 && slug[1] === "diagnostics") {
      return ok(diagnostics(role, slug[0]!, request));
    }

    return notFound();
  } catch (e) {
    return failure(e);
  }
}
