import pg from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      logger.error("Unexpected error on idle client", err);
    });

    pool.on("connect", () => {
      logger.info("Database client connected");
    });
  }
  return pool;
}

export function setPool(newPool: pg.Pool | null): void {
  if (pool && newPool) {
    logger.warn("Replacing existing database connection pool");
  }
  pool = newPool;
}

export async function resetPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info("Database connection pool closed");
  }
}

export async function query(
  text: string,
  params?: any[]
): Promise<pg.QueryResult> {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function waitForDatabase(maxRetries = 30, delayMs = 1000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const p = getPool();
      await p.query("SELECT 1");
      logger.info("Database connection established");
      return;
    } catch (err) {
      logger.warn(
        `Database not ready (attempt ${i + 1}/${maxRetries}), retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Could not connect to database after maximum retries");
}
