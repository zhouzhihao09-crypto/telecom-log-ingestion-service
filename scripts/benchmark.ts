import http from "http";
import { config } from "../src/config";
import { logger } from "../src/utils/logger";
import { TelecomEvent, SmsEvent, DataUsageEvent } from "../src/types/events";

const API_HOST = process.env.API_HOST || "localhost";
const API_PORT = parseInt(process.env.API_PORT || String(config.port || 3000), 10);
const API_URL = process.env.API_URL || `http://${API_HOST}:${API_PORT}/api/events`;

const TOTAL_EVENTS = parseInt(process.env.EVENTS || "100000", 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || String(config.batching.batchSize || 500), 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "5", 10);

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

function generateSmsEvent(id: number, ts: Date): SmsEvent {
  return {
    eventId: `bms-${String(id).padStart(8, "0")}`,
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
    eventId: `bmd-${String(id).padStart(8, "0")}`,
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

interface SendResult {
  success: boolean;
  statusCode: number;
}

function sendBatch(batchId: number, events: TelecomEvent[], batchSize: number): Promise<SendResult> {
  return new Promise((resolve) => {
    const body = JSON.stringify({ events });

    const req = http.request(
      API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 60000,
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          const success = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300;
          if (!success) {
            logger.warn(`Batch ${batchId} (${batchSize} events) failed: ${res.statusCode}`);
          }
          resolve({ success, statusCode: res.statusCode || 0 });
        });
      }
    );

    req.on("error", (err) => {
      logger.warn(`Batch ${batchId} network error: ${(err as Error).message}`);
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
  console.log("Starting benchmark...");
  console.log(`Events: ${TOTAL_EVENTS}`);
  console.log(`Batches: ${Math.ceil(TOTAL_EVENTS / BATCH_SIZE)}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Target API: ${API_URL}`);
  console.log("");

  const startTime = Date.now();
  let totalSent = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let batchId = 0;

  const baseTime = new Date();

  while (totalSent < TOTAL_EVENTS) {
    const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_EVENTS - totalSent);
    const batch = generateBatch(totalSent + 1, currentBatchSize, baseTime);
    const currentBatchId = ++batchId;
    totalSent += currentBatchSize;

    const result = await sendBatch(currentBatchId, batch, currentBatchSize);

    if (result.success) {
      successfulRequests++;
    } else {
      failedRequests++;
    }

    if (batchId % 20 === 0 || totalSent === TOTAL_EVENTS) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = totalSent / elapsed;
      console.log(`Progress: ${totalSent}/${TOTAL_EVENTS} events (${batchId} batches, ${failedRequests} failed) - ${Math.round(rate)} events/sec`);
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  const throughput = TOTAL_EVENTS / duration;
  const totalBatches = Math.ceil(TOTAL_EVENTS / BATCH_SIZE);

  console.log("");
  console.log("=== Benchmark Results ===");
  console.log(`Events: ${TOTAL_EVENTS}`);
  console.log(`Batches: ${totalBatches}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log(`Throughput: ${Math.round(throughput)} events/sec`);
  console.log(`Successful requests: ${successfulRequests}`);
  console.log(`Failed requests: ${failedRequests}`);
}

void main();
