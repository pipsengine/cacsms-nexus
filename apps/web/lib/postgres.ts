import "server-only";

type PgPool = import("pg").Pool;
type PgPoolClient = import("pg").PoolClient;
type QueryResultRow = import("pg").QueryResultRow;

declare global {
  var __cacsmsPgPool: PgPool | undefined;
}

let pgModulePromise: Promise<typeof import("pg")> | null = null;

function loadPgModule() {
  if (!pgModulePromise) {
    pgModulePromise = import("pg");
  }
  return pgModulePromise;
}

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return url;
}

async function createPool() {
  const { Pool } = await loadPgModule();
  return new Pool({
    connectionString: getDatabaseUrl(),
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.POSTGRES_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS ?? 30_000)
  });
}

async function getPostgresPool() {
  if (globalThis.__cacsmsPgPool) {
    return globalThis.__cacsmsPgPool;
  }

  const pool = await createPool();
  if (process.env.NODE_ENV !== "production") {
    globalThis.__cacsmsPgPool = pool;
  }
  return pool;
}

export async function query<T extends QueryResultRow>(text: string, values?: unknown[]) {
  return getPostgresPool().then((pool) => pool.query<T>(text, values));
}

export async function withClient<T>(handler: (client: PgPoolClient) => Promise<T>) {
  const client = await getPostgresPool().then((pool) => pool.connect());
  try {
    return await handler(client);
  } finally {
    client.release();
  }
}

export function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
