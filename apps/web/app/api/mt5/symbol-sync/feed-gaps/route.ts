import { ok } from "../../_lib/http";
import { issues } from "../_lib/store";

export function GET() {
  return ok(issues().filter((issue) => ["Missing Tick", "Delayed Tick", "Spread Anomaly"].includes(issue.issueType)));
}
