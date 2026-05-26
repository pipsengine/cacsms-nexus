import { ensureMt5Ready } from "../_lib/ensure-ready";
import { buildControlCenter, getRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureMt5Ready("mt5-control-center");
  const role = getRole(request);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = () => controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(buildControlCenter(role))}\n\n`));
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
