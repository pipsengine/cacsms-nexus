import { failure, ok } from "../../_lib/http";
import { chartRole, refreshCharts } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(refreshCharts(chartRole(request), Boolean(body.confirmed), request));
  } catch (error) { return failure(error); }
}
