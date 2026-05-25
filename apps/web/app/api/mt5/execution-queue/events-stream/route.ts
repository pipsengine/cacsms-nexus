import { buildSummary, executionQueueRole, listItems } from "../_lib/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const role = executionQueueRole(request);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const payload = {
          summary: buildSummary(role),
          items: listItems({ page: 1, pageSize: 60, status: "all", priority: "all" })
        };
        controller.enqueue(encoder.encode(`event: queue-snapshot\ndata: ${JSON.stringify(payload)}\n\n`));
      };
      send();
      const interval = setInterval(send, 5000);
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}

