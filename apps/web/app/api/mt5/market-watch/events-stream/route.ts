import { buildMarketWatchResponse, marketRole } from "../_lib/store";

export const dynamic = "force-dynamic";
export function GET(request: Request) {
  const role = marketRole(request);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = () => controller.enqueue(encoder.encode(`event: market-snapshot\ndata: ${JSON.stringify(buildMarketWatchResponse(role))}\n\n`));
      send();
      const interval = setInterval(send, 5000);
      request.signal.addEventListener("abort", () => { clearInterval(interval); controller.close(); });
    }
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
