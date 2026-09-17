import { config } from "../config";

const isProduction = process.env.NODE_ENV === "production";

function formatMessage(level: string, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

export const logger = {
  info(message: string, meta?: unknown): void {
    if (!isProduction || process.env.LOG_LEVEL === "info") {
      console.log(formatMessage("INFO", message, meta));
    }
  },
  warn(message: string, meta?: unknown): void {
    console.warn(formatMessage("WARN", message, meta));
  },
  error(message: string, error?: Error | unknown): void {
    if (error instanceof Error) {
      console.error(formatMessage("ERROR", message, { message: error.message, stack: isProduction ? undefined : error.stack }));
    } else {
      console.error(formatMessage("ERROR", message, error));
    }
  },
  debug(message: string, meta?: unknown): void {
    if (process.env.LOG_LEVEL === "debug") {
      console.debug(formatMessage("DEBUG", message, meta));
    }
  },
};
