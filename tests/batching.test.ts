import { IngestionService } from "../src/services/ingestionService";
import { getPool } from "../src/db/pool";
import { SmsEvent } from "../src/types/events";

function makeSmsEvent(id: number): SmsEvent {
  return {
    eventId: `batch-test-${id}`,
    eventType: "SMS",
    timestamp: "2026-09-17T10:00:00.000Z",
    subscriberId: "S1234567A",
    sourceNumber: "+6591234567",
    destinationNumber: "+6587654321",
    messageSize: 120,
    status: "DELIVERED",
  };
}

describe("Batching Behavior", () => {
  let service: IngestionService | null = null;

  afterEach(async () => {
    if (service) {
      await service.shutdown();
      service = null;
    }
    const pool = getPool();
    await pool.query("TRUNCATE TABLE telecom_events RESTART IDENTITY CASCADE");
  });

  it("should flush when batch size is reached", async () => {
    service = new IngestionService(5, 5000);
    service.start();

    for (let i = 0; i < 5; i++) {
      await service.enqueue(makeSmsEvent(i));
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    const stats = service.getStats();
    expect(stats.flushCount).toBeGreaterThanOrEqual(1);
    expect(stats.totalInserted).toBe(5);
    expect(service.getBufferSize()).toBe(0);
  });

  it("should flush on interval timeout", async () => {
    service = new IngestionService(100, 100);
    service.start();

    for (let i = 0; i < 3; i++) {
      await service.enqueue(makeSmsEvent(i));
    }

    await new Promise((resolve) => setTimeout(resolve, 400));

    const stats = service.getStats();
    expect(stats.flushCount).toBeGreaterThanOrEqual(1);
    expect(stats.totalInserted).toBe(3);
  });

  it("should not flush empty buffer", async () => {
    service = new IngestionService(10, 100);
    service.start();

    await new Promise((resolve) => setTimeout(resolve, 300));

    const stats = service.getStats();
    expect(stats.flushCount).toBe(0);
    expect(stats.totalInserted).toBe(0);
  });

  it("should flush remaining events on shutdown", async () => {
    service = new IngestionService(100, 10000);
    service.start();

    for (let i = 0; i < 3; i++) {
      await service.enqueue(makeSmsEvent(i));
    }

    expect(service.getBufferSize()).toBe(3);

    await service.shutdown();

    const stats = service.getStats();
    service = null;

    expect(stats.totalInserted).toBe(3);
    expect(service === null).toBe(true);
  });

  it("should accumulate events in buffer until flush", async () => {
    service = new IngestionService(10, 10000);
    service.start();

    for (let i = 0; i < 4; i++) {
      await service.enqueue(makeSmsEvent(i));
    }

    expect(service.getBufferSize()).toBe(4);

    const stats = service.getStats();
    expect(stats.totalEnqueued).toBe(4);
    expect(stats.totalInserted).toBe(0);
  });

  it("should prevent duplicate events (idempotency)", async () => {
    service = new IngestionService(3, 10000);
    service.start();

    const event = makeSmsEvent(0);
    await service.enqueue(event);
    await service.enqueue(event);
    await service.enqueue(event);

    await service.shutdown();

    const stats = service.getStats();
    expect(stats.totalEnqueued).toBe(3);

    const pool = getPool();
    const res = await pool.query(
      "SELECT count(*) FROM telecom_events WHERE event_id = $1",
      ["batch-test-0"]
    );
    expect(parseInt(res.rows[0].count, 10)).toBe(1);
  });
});