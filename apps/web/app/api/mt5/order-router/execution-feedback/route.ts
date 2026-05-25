import { ok } from "../../_lib/http";
import { executionFeedback } from "../_lib/store";

export function GET() { return ok(executionFeedback()); }
