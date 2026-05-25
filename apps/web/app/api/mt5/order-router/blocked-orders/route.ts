import { ok } from "../../_lib/http";
import { blockedOrders } from "../_lib/store";

export function GET() { return ok(blockedOrders()); }
