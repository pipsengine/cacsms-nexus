import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "MT5 operation failed.";
  const status = message.includes("not authorized") ? 403 : message.includes("not found") ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}
