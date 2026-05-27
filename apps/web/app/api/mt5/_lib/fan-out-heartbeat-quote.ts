import "server-only";

import type { LiveQuoteInput } from "./quote-ingest-shared";
import { runAutonomousPipeline } from "./autonomous-orchestrator";

export async function fanOutHeartbeatQuote(input: LiveQuoteInput) {
  await Promise.allSettled([
    import("../market-watch/_lib/store").then(({ ingestHeartbeatQuote }) => ingestHeartbeatQuote(input)),
    import("../symbol-sync/_lib/store").then(({ ingestHeartbeatQuote }) => ingestHeartbeatQuote(input)),
    import("../chart-control/_lib/store").then(({ ingestHeartbeatQuote }) => ingestHeartbeatQuote(input)),
    import("../spread-monitor/_lib/store").then(({ ingestHeartbeatQuote }) => ingestHeartbeatQuote(input))
  ]);
  await runAutonomousPipeline("heartbeat", input);
}
