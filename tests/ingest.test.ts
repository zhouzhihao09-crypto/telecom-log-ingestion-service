import { createServer } from "../src/server";
import { IngestionService } from "../src/services/ingestionService";
import { getPool } from "../src/db/pool";

function makeSmsEvent(id: number = 1) {
  return {
    eventId: `test-sms-${id}`,
    eventType: "SMS" as const,
    timestamp: "2026-09-17T10:00:00.000Z",
    subscriberId: "S1234567A",
    sourceNumber: "+6591234567",
    destinationNumber: "+6587654321",
    messageSize: 120,
    status: "DELIVERED",
  };
}

function makeDataUsageEvent(id: number = 1) {
  return {
    eventId: `test-data-${id}`,
    eventType: "DATA_USAGE" as const,
    timestamp: "2026-09-17T10:00:00.000Z",
    subscriberId: "S8765432B",
    bytesUsed: 5242880,
    networkType: "5G",
  };
}

describe("Ingestion API", () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let ingestionService: IngestionService;

  beforeAll(async () => {
    ingestionService = new IngestionService(5, 50);
    ingestionService.start();
    app = await createServer({ ingestionService });
  });

  afterAll(async () => {
    await ingestionService.shutdown();
    await app.close();
  });

  afterEach(async () => {
    await getPool().query("TRUNCATE TABLE telecom_events RESTART IDENTITY CASCADE");
  });

  it("should accept a single SMS event", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: makeSmsEvent(),
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.accepted).toBe(1);
  });

  it("should accept a single DATA_USAGE event", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: makeDataUsageEvent(),
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.accepted).toBe(1);
  });

  it("should accept a batch of events", async () => {
    const events = [makeSmsEvent(1), makeDataUsageEvent(1), makeSmsEvent(2)];

    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: { events },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.accepted).toBe(3);
  });

  it("should accept an array of events as body", async () => {
    const events = [makeSmsEvent(3), makeDataUsageEvent(4)];

    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: events,
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.accepted).toBe(2);
  });

  it("should reject an invalid event with missing eventId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        eventType: "SMS",
        timestamp: "2026-09-17T10:00:00.000Z",
        subscriberId: "S1234567A",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("eventId");
  });

  it("should reject an event with invalid eventType", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        eventId: "test-invalid-1",
        eventType: "INVALID_TYPE",
        timestamp: "2026-09-17T10:00:00.000Z",
        subscriberId: "S1234567A",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("eventType");
  });

  it("should reject a batch with an invalid event", async () => {
    const events = [makeSmsEvent(5), { eventId: "bad", eventType: "SMS" }];

    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: { events },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
  });

  it("should reject non-object body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: 42,
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("must be a JSON object");
  });

  it("should reject empty batch", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: { events: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it("should handle duplicate event_id (idempotency)", async () => {
    const event = makeSmsEvent(10);

    const res1 = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: event,
    });
    expect(res1.statusCode).toBe(202);

    const res2 = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: event,
    });
    expect(res2.statusCode).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const pool = getPool();
    const result = await pool.query(
      "SELECT count(*) FROM telecom_events WHERE event_id = $1",
      ["test-sms-10"]
    );
    expect(parseInt(result.rows[0].count, 10)).toBe(1);
  });

  it("should insert valid events into the database", async () => {
    const event = makeSmsEvent(20);
    await app.inject({
      method: "POST",
      url: "/api/events",
      payload: event,
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    const pool = getPool();
    const result = await pool.query(
      "SELECT * FROM telecom_events WHERE event_id = $1",
      ["test-sms-20"]
    );
    expect(result.rows.length).toBe(1);

    const row = result.rows[0];
    expect(row.event_type).toBe("SMS");
    expect(row.subscriber_id).toBe("S1234567A");
    expect(row.payload).toEqual(
      expect.objectContaining({
        sourceNumber: "+6591234567",
        destinationNumber: "+6587654321",
        messageSize: 120,
        status: "DELIVERED",
      })
    );
  });
});