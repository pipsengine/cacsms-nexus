import { ok } from "../../_lib/http";
import { brokerExecutionQuality } from "../_lib/store";

export function GET() { return ok(brokerExecutionQuality()); }
