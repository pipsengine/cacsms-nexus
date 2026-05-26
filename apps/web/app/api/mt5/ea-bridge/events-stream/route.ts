import { withEaBridgeStore } from "../_lib/handler";
import { buildEaBridgeResponse, eaBridgeRole } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = eaBridgeRole(request);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        const snapshot = await withEaBridgeStore(() => buildEaBridgeResponse(role));
        controller.enqueue(encoder.encode(`event: bridge-snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
      };
      void send();
      const interval = setInterval(() => {
        void send();
      }, 5000);
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
