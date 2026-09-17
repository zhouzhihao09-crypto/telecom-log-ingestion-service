import http from "http";
import { config } from "../src/config";
import { logger } from "../src/utils/logger";
import { TelecomEvent, SmsEvent, DataUsageEvent } from "../src/types/events";

const API_HOST = process.env.API_HOST || "localhost";
const API_PORT = parseInt(process.env.API_PORT || String(config.port || 3000), 10);
const API_URL = process.env.API_URL || `http://${API_HOST}:${API_PORT}/api/events`;

const TOTAL_EVENTS = parseInt(process.env.EVENTS || "100000", 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || String(config.batching.batchSize || 500), 10);

const SUBSCRIBER_PREFIXES = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"];
const NETWORK_TYPES = ["2G", "3G", "4G", "5G"];
const SMS_STATUSES = ["DELIVERED", "FAILED", "PENDING", "REJECTED"];
const SG_PREFIXES = ["+659", "+658"];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSubscriberId(): string {
  const prefix = SUBSCRIBER_PREFIXES[Math.floor(Math.random() * SUBSCRIBER_PREFIXES.length)];
  const nums = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join("");
  return `${prefix}${nums}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
}

function randomPhoneNumber(): string {
  const prefix = SG_PREFIXES[Math.floor(Math.random() * SG_PREFIXES.length)];
  const nums = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join("");
  return `${prefix}${nums}`;
}

function randomTimestamp(start: Date, end: Date): Date {
  const ms = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(ms);
}

function generateSmsEvent(id: number, ts: Date): SmsEvent {
  return {
    eventId: `sms-${String(id).padStart(8, "0")}`,
    eventType: "SMS",
    timestamp: ts.toISOString(),
    subscriberId: randomSubscriberId(),
    sourceNumber: randomPhoneNumber(),
    destinationNumber: randomPhoneNumber(),
    messageSize: randomInt(20, 500),
    status: SMS_STATUSES[Math.floor(Math.random() * SMS_STATUSES.length)],
  };
}

function generateDataUsageEvent(id: number, ts: Date): DataUsageEvent {
  return {
    eventId: `data-${String(id).padStart(8, "0")}`,
    eventType: "DATA_USAGE",
    timestamp: ts.toISOString(),
    subscriberId: randomSubscriberId(),
    bytesUsed: randomInt(64 * 1024, 100 * 1024 * 1024),
    networkType: NETWORK_TYPES[Math.floor(Math.random() * NETWORK_TYPES.length)],
  };
}

function generateEvent(id: number, ts: Date): TelecomEvent {
  return Math.random() < 0.7 ? generateSmsEvent(id, ts) : generateDataUsageEvent(id, ts);
}

function generateBatch(startId: number, size: number, baseTime: Date): TelecomEvent[] {
  const batch: TelecomEvent[] = [];
  for (let i = 0; i < size; i++) {
    const ts = new Date(baseTime.getTime() + i * 100);
    batch.push(generateEvent(startId + i, ts));
  }
  return batch;
}

function sendBatch(events: TelecomEvent[], batchNum: number, batchSize: number): Promise<{ success: boolean; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ events });
    const req = http.request(
      API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, statusCode: res.statusCode });
          } else {
            logger.warn(`Batch ${batchNum} failed with status ${res.statusCode}: ${data}`);
            resolve({ success: false, statusCode: res.statusCode || 0 });
          }
        });
      }
    );

    req.on("error", (err) => {
      logger.error(`Batch ${batchNum} request error`, err);
      resolve({ success: false, statusCode: 0 });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ success: false, statusCode: 0 });
    });

    req.write(body);
    req.end();
  });
}

async function main(): Promise<void> {
  logger.info("Starting log generator...");
  logger.info(`Total events: ${TOTAL_EVENTS}`);
  logger.info(`Batch size: ${BATCH_SIZE}`);
  logger.info(`Target API: ${API_URL}`);

  const startTime = Date.now();
  let totalSent = 0;
  let totalBatches = 0;
  let failedBatches = 0;
  const baseTime = new Date();

  while (totalSent < TOTAL_EVENTS) {
    const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_EVENTS - totalSent);
    const batch = generateBatch(totalSent + 1, currentBatchSize, baseTime);

    const result = await sendBatch(batch, totalBatches + 1, currentBatchSize);

    totalSent += currentBatchSize;
    totalBatches++;

    if (!result.success) {
      failedBatches++;
    }

    if (totalBatches % 10 === 0 || totalSent === TOTAL_EVENTS) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = totalSent / elapsed;
      logger.info(`Progress: ${totalSent}/${TOTAL_EVENTS} events (${totalBatches} batches, ${failedBatches} failed) - ${Math.round(rate)} events/sec`);
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const rate = totalSent / elapsed;

  logger.info("Log generation complete!");
  logger.info(`Total events sent: ${totalSent}`);
  logger.info(`Total batches: ${totalBatches}`);
  logger.info(`Failed batches: ${failedBatches}`);
  logger.info(`Duration: ${elapsed.toFixed(2)} seconds`);
  logger.info(`Throughput: ${Math.round(rate)} events/sec`);
}

void main();
