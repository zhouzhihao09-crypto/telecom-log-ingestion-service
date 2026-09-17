import pg from "pg";
import { config } from "../config";
import { logger } from "../utils/logger";
import { getPool } from "../db/pool";
import { TelecomEvent, splitEventFields } from "../types/events";

interface BufferedEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  subscriberId: string;
  payload: string;
}

interface BatchStats {
  totalEnqueued: number;
  totalInserted: number;
  totalDuplicates: number;
  totalErrors: number;
  flushCount: number;
  lastBatchSize: number;
}

export class IngestionService {
  private buffer: BufferedEvent[] = [];
  private isFlushing = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private pendingFlush: Promise<void> = Promise.resolve();
  private stats: BatchStats = {
    totalEnqueued: 0,
    totalInserted: 0,
    totalDuplicates: 0,
    totalErrors: 0,
    flushCount: 0,
    lastBatchSize: 0,
  };

  constructor(
    private batchSize: number = config.batching.batchSize,
    private intervalMs: number = config.batching.intervalMs
  ) {}

  start(): void {
    logger.info(`IngestionService started (batchSize=${this.batchSize}, intervalMs=${this.intervalMs})`);
    this.flushTimer = setInterval(() => {
      this.pendingFlush = this.flush().catch((err) => {
        logger.error("Flush error", err as Error);
      });
    }, this.intervalMs);
  }

  async enqueue(event: TelecomEvent): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error("IngestionService is shutting down");
    }

    const { common, payload } = splitEventFields(event);
    this.buffer.push({
      eventId: common.event_id,
      eventType: common.event_type,
      timestamp: common.timestamp,
      subscriberId: common.subscriber_id,
      payload: JSON.stringify(payload),
    });

    this.stats.totalEnqueued++;

    if (this.buffer.length >= this.batchSize && !this.isFlushing) {
      this.pendingFlush = this.flush();
    }
  }

  async enqueueBatch(events: TelecomEvent[]): Promise<{ accepted: number }> {
    if (this.isShuttingDown) {
      throw new Error("IngestionService is shutting down");
    }

    for (const event of events) {
      const { common, payload } = splitEventFields(event);
      this.buffer.push({
        eventId: common.event_id,
        eventType: common.event_type,
        timestamp: common.timestamp,
        subscriberId: common.subscriber_id,
        payload: JSON.stringify(payload),
      });
      this.stats.totalEnqueued++;
    }

    if (this.buffer.length >= this.batchSize && !this.isFlushing) {
      this.pendingFlush = this.flush();
    }

    return { accepted: events.length };
  }

  private async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;

    const batch = this.buffer.splice(0, this.buffer.length);
    this.stats.lastBatchSize = batch.length;

    try {
      const result = await this.bulkInsert(batch);
      this.stats.totalInserted += result.inserted;
      this.stats.totalDuplicates += result.duplicates;
      this.stats.flushCount++;
    } catch (err) {
      this.stats.totalErrors++;
      logger.error(`Batch insert failed (${batch.length} events)`, err as Error);
    } finally {
      this.isFlushing = false;
    }
  }

  private async bulkInsert(
    batch: BufferedEvent[]
  ): Promise<{ inserted: number; duplicates: number }> {
    const pool = getPool();

    const MAX_PARAMS_PER_QUERY = 65535;
    const FIELDS_PER_EVENT = 5;
    const MAX_EVENTS_PER_CHUNK = Math.floor(MAX_PARAMS_PER_QUERY / FIELDS_PER_EVENT);

    let totalInserted = 0;

    for (let i = 0; i < batch.length; i += MAX_EVENTS_PER_CHUNK) {
      const chunk = batch.slice(i, i + MAX_EVENTS_PER_CHUNK);

      const values: any[] = [];
      const valuePlaceholders: string[] = [];
      let paramIndex = 1;

      for (const event of chunk) {
        valuePlaceholders.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
        );
        values.push(
          event.eventId,
          event.eventType,
          event.timestamp,
          event.subscriberId,
          event.payload
        );
        paramIndex += 5;
      }

      const queryText = `
        INSERT INTO telecom_events (event_id, event_type, timestamp, subscriber_id, payload)
        VALUES ${valuePlaceholders.join(", ")}
        ON CONFLICT (event_id) DO NOTHING
      `;

      const result = await pool.query(queryText, values);
      totalInserted += result.rowCount ?? 0;
    }

    const duplicates = batch.length - totalInserted;

    logger.debug(`Inserted ${totalInserted} events, ${duplicates} duplicates`);

    return { inserted: totalInserted, duplicates };
  }

  getStats(): BatchStats {
    return { ...this.stats };
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  async shutdown(): Promise<void> {
    logger.info("IngestionService shutting down...");
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.pendingFlush;

    await this.flush();

    await this.pendingFlush;

    while (this.buffer.length > 0) {
      await this.flush();
      await this.pendingFlush;
      if (this.buffer.length > 0) {
        logger.info(`Waiting to drain ${this.buffer.length} remaining events...`);
        await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
      }
    }

    logger.info(
      `IngestionService shutdown complete. Stats: ${JSON.stringify(this.stats)}`
    );
  }
}
