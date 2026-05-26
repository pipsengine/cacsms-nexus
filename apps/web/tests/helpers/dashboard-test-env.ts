import { vi } from "vitest";

export class MockEventSource {
  addEventListener() {}
  close() {}
  onerror = null;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function setupDashboardTestEnv() {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  vi.stubGlobal("EventSource", MockEventSource);
}

export function installFetchMock(handlers: Record<string, () => unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      for (const [pattern, handler] of Object.entries(handlers)) {
        if (url.includes(pattern)) return jsonResponse(handler());
      }
      return jsonResponse({ meta: { timestamp: new Date().toISOString() } });
    })
  );
}

export function teardownDashboardTestEnv() {
  vi.unstubAllGlobals();
}
