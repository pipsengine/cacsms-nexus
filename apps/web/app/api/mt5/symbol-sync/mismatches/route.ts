import { ok } from "../../_lib/http";
import { issues } from "../_lib/store";

export function GET() {
  return ok(issues().filter((issue) => ["Unknown Symbol", "Mapping Mismatch", "Duplicate Mapping"].includes(issue.issueType)));
}
