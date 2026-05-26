import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __cacsmsPgPool: Pool | undefined;
}

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return url;
}

function createPool() {
  return new Pool({
    connectionString: getDatabaseUrl(),
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.POSTGRES_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS ?? 30_000)
  });
}

export const postgresPool =
  globalThis.__cacsmsPgPool ??
  (() => {
    const pool = createPool();
    if (process.env.NODE_ENV !== "production") {
      globalThis.__cacsmsPgPool = pool;
    }
    return pool;
  })();

export async function query<T extends QueryResultRow>(text: string, values?: unknown[]) {
  return postgresPool.query<T>(text, values);
}

export async function withClient<T>(handler: (client: PoolClient) => Promise<T>) {
  const client = await postgresPool.connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
}
