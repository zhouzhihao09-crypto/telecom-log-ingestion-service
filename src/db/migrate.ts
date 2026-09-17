import fs from "fs";
import path from "path";
import { getPool } from "./pool";
import { logger } from "../utils/logger";

const migrationsDir = path.join(__dirname, "migrations");

export async function runMigrations(): Promise<void> {
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const db = getPool();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    try {
      await db.query(sql);
      logger.info(`Migration applied: ${file}`);
    } catch (err) {
      logger.error(`Migration failed: ${file}`, err as Error);
      throw err;
    }
  }
}
