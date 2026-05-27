import "server-only";

const DEFAULT_INTERVAL_MS = 1_000;

export function mt5StreamIntervalMs() {
  const raw = process.env.MT5_SSE_INTERVAL_MS;
  if (!raw) return DEFAULT_INTERVAL_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 250 ? parsed : DEFAULT_INTERVAL_MS;
}

export function mt5EventStreamHeaders(): HeadersInit {
  return {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  };
}

export function createMt5EventStream(input: {
  request: Request;
  eventName: string;
  snapshot: () => unknown | Promise<unknown>;
  intervalMs?: number;
}) {
  const intervalMs = input.intervalMs ?? mt5StreamIntervalMs();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        void Promise.resolve(input.snapshot())
          .then((payload) => {
            controller.enqueue(encoder.encode(`event: ${input.eventName}\ndata: ${JSON.stringify(payload)}\n\n`));
          })
          .catch(() => {
            controller.enqueue(encoder.encode(`event: error\ndata: {"message":"snapshot failed"}\n\n`));
          });
      };

      send();
      const interval = setInterval(send, intervalMs);
      input.request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, { headers: mt5EventStreamHeaders() });
}
