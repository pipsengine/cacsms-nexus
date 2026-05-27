import "server-only";

import type { LiveQuoteInput } from "./quote-ingest-shared";

export type AutonomousPipelineSource = "heartbeat" | "account-snapshot" | "position-update" | "pending-order-update";

export async function runAutonomousPipeline(source: AutonomousPipelineSource, quote?: LiveQuoteInput) {
  await Promise.allSettled([
    import("../symbol-sync/_lib/store").then(({ autonomousSyncSymbols }) => autonomousSyncSymbols(source, quote)),
    import("../order-router/_lib/store").then(({ autonomousSyncRouting }) => autonomousSyncRouting(source)),
    import("../account-sync/_lib/store").then(({ autonomousReconcileAccounts }) => autonomousReconcileAccounts(source)),
    import("../connection-health/_lib/store").then(({ autonomousRefreshHealth }) => autonomousRefreshHealth(source)).catch(() => undefined)
  ]);
}
