import { newDb } from "pg-mem";
import { setPool, getPool, resetPool } from "../src/db/pool";
import { logger } from "../src/utils/logger";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

let db: ReturnType<typeof newDb> | null = null;
let pool: any = null;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS telecom_events (
      id            SERIAL PRIMARY KEY,
      event_id      TEXT    NOT NULL UNIQUE,
      event_type    TEXT    NOT NULL,
      timestamp     TIMESTAMPTZ NOT NULL,
      subscriber_id TEXT    NOT NULL,
      payload       JSONB   NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_events_subscriber_id ON telecom_events (subscriber_id);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON telecom_events (timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON telecom_events (event_type, timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_payload_gin ON telecom_events USING GIN (payload);
`;

export async function setupTestDb(): Promise<void> {
  await resetPool();

  db = newDb();
  db.enabledLog = false;

  const mockPg = db.adapters.createPg();
  pool = new mockPg.Pool();

  setPool(pool);
  logger.info("Test database (pg-mem) started");

  await pool.query(CREATE_TABLE_SQL);
  logger.info("Test database schema created");
}

export async function teardownTestDb(): Promise<void> {
  await resetPool();
  pool = null;
  if (db) {
    db = null;
  }
  setPool(null);
}

export async function cleanupTables(): Promise<void> {
  const p = getPool();
  await p.query("TRUNCATE TABLE telecom_events RESTART IDENTITY CASCADE");
}

beforeAll(async () => {
  await setupTestDb();
  logger.info("Test database setup complete");
});

afterAll(async () => {
  await teardownTestDb();
  logger.info("Test database teardown complete");
});

beforeEach(async () => {
  await cleanupTables();
});
