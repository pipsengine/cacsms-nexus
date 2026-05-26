import { NextResponse } from "next/server";

import { MT5_MODULE_KEYS } from "@/app/api/mt5/_lib/module-keys";
import { query } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await query<{ now: Date; current_database: string; current_user: string }>(
      "select now() as now, current_database() as current_database, current_user as current_user"
    );
    const row = result.rows[0];
    let persistedModules: Array<{ moduleKey: string; updatedAt: string }> = [];

    try {
      const modules = await query<{ module_key: string; updated_at: Date }>(
        "select module_key, updated_at from mt5_module_states order by module_key"
      );
      persistedModules = modules.rows.map((entry) => ({
        moduleKey: entry.module_key,
        updatedAt: entry.updated_at.toISOString()
      }));
    } catch {
      persistedModules = [];
    }

    return NextResponse.json(
      {
        ok: true,
        database: row?.current_database ?? null,
        user: row?.current_user ?? null,
        serverTime: row?.now?.toISOString?.() ?? null,
        mt5Modules: {
          expected: MT5_MODULE_KEYS.length,
          persisted: persistedModules.length,
          entries: persistedModules
        }
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
