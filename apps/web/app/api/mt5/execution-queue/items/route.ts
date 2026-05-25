import { failure, ok } from "../../_lib/http";
import { listItems } from "../_lib/store";

export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const priority = url.searchParams.get("priority") ?? undefined;
    const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined;
    const pageSize = url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined;
    return ok(listItems({ search, status, priority, page, pageSize }));
  } catch (e) {
    return failure(e);
  }
}

