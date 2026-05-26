import { ok } from "../../_lib/http";
import { createTerminalUuid } from "../../_lib/store";
import { NIGERIA_TIME_ZONE } from "@/lib/nigeria-time";

export function GET() {
  return ok({
    terminalUuid: createTerminalUuid(),
    terminalVersion: "5.00 build 4770",
    eaName: "NexusBridgeEA",
    symbolScope: ["EURUSD", "XAUUSD"],
    timezone: NIGERIA_TIME_ZONE,
    region: "Lagos"
  });
}