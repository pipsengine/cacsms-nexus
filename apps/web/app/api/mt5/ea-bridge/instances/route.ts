import { ok } from "../../_lib/http";
import { publicBridgeInstances } from "../_lib/store";

export function GET() { return ok(publicBridgeInstances()); }
