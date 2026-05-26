import { ok } from "../../_lib/http";
import { MT5_BROKER_CATALOG, ONBOARDING_FORM_OPTIONS } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/data/broker-catalog";

export function GET() {
  return ok({ catalog: MT5_BROKER_CATALOG, formOptions: ONBOARDING_FORM_OPTIONS });
}
