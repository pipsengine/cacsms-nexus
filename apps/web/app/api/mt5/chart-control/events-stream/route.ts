import { buildChartControlResponse, chartRole } from "../_lib/store";

export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const role = chartRole(request);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = () => controller.enqueue(encoder.encode(`event: chart-snapshot\ndata: ${JSON.stringify(buildChartControlResponse(role))}\n\n`));
      send();
      const interval = setInterval(send, 5000);
      request.signal.addEventListener("abort", () => { clearInterval(interval); controller.close(); });
    }
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
