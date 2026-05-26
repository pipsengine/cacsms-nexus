import type { NextRequest } from "next/server";

import { failure, ok } from "../../_lib/http";
import {
  aiDiagnostics,
  auditTrail,
  autoRemediate,
  categories,
  diagnostics,
  errorDetail,
  errorLogsRole,
  escalateError,
  exportReport,
  incidents,
  repeated,
  reopenError,
  resolveError,
  resolutions,
  summary,
  sync,
  trends,
  workflow
} from "../_lib/store";

export const dynamic = "force-dynamic";

function notFound() {
  throw new Error("not found");
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = errorLogsRole(request);

  try {
    if (slug[0] === "events-stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = () => {
            const payload = { summary: summary(role) };
            controller.enqueue(encoder.encode(`event: error-logs-snapshot\ndata: ${JSON.stringify(payload)}\n\n`));
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
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" }
      });
    }

    if (slug[0] === "summary") return ok(summary(role));
    if (slug[0] === "workflow") return ok(workflow());
    if (slug[0] === "categories") return ok(categories());
    if (slug[0] === "trends") return ok(trends());
    if (slug[0] === "repeated") return ok(repeated());
    if (slug[0] === "incidents") return ok(incidents());
    if (slug[0] === "ai-diagnostics") return ok(aiDiagnostics());
    if (slug[0] === "resolutions") return ok(resolutions());
    if (slug[0] === "audit") return ok(auditTrail());

    if (slug.length === 1) return ok(errorDetail(slug[0]!));

    return notFound();
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const role = errorLogsRole(request);

  try {
    if (slug[0] === "sync") return ok(sync(role, request));

    if (slug[0] === "diagnostics") return ok(diagnostics(role, null, request));

    if (slug[0] === "auto-remediate") {
      const body = (await request.json().catch(() => ({}))) as any;
      return ok(autoRemediate(role, String(body.errorId), request));
    }

    if (slug[0] === "export") {
      const payload = (await request.json()) as any;
      return ok(exportReport(payload, role, request));
    }

    if (slug.length === 2 && slug[1] === "resolve") {
      const payload = (await request.json()) as any;
      return ok(resolveError(slug[0]!, payload, role, request));
    }
    if (slug.length === 2 && slug[1] === "reopen") {
      const payload = (await request.json()) as any;
      return ok(reopenError(slug[0]!, payload, role, request));
    }
    if (slug.length === 2 && slug[1] === "escalate") {
      const payload = (await request.json()) as any;
      return ok(escalateError(slug[0]!, payload, role, request));
    }
    if (slug.length === 2 && slug[1] === "diagnostics") {
      return ok(diagnostics(role, slug[0]!, request));
    }

    return notFound();
  } catch (e) {
    return failure(e);
  }
}
