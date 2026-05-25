import { failure, ok } from "../../_lib/http";
import { marketRole, refreshQuotes } from "../_lib/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { confirmed?: boolean };
    return ok(refreshQuotes(marketRole(request), Boolean(body.confirmed), request));
  } catch (error) {
    return failure(error);
  }
}
