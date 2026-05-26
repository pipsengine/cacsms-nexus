import { NextResponse } from "next/server";

import { query } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await query<{ now: Date; current_database: string; current_user: string }>(
      "select now() as now, current_database() as current_database, current_user as current_user"
    );
    const row = result.rows[0];

    return NextResponse.json(
      {
        ok: true,
        database: row?.current_database ?? null,
        user: row?.current_user ?? null,
        serverTime: row?.now?.toISOString?.() ?? null
      },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Database connection failed."
      },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
