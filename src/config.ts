import dotenv from "dotenv";

dotenv.config();

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  database: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/telecom_logs",
  },
  batching: {
    batchSize: parseInt(process.env.BATCH_SIZE || "500", 10),
    intervalMs: parseInt(process.env.BATCH_INTERVAL_MS || "100", 10),
  },
  maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || "1048576", 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || "30000", 10),
};
