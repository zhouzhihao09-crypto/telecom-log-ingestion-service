# Demo Walkthrough

A 60–90 second demonstration of the Telecom Log Ingestion Service.

## 1. Introduction

The Telecom Log Ingestion Service is a Node.js/TypeScript backend that ingests telecom SMS and data usage events over HTTP, validates them, buffers them in memory, and writes them to PostgreSQL in batches. Built with Fastify, PostgreSQL, and Docker Compose.

## 2. Architecture

```
Log Generator → Fastify API → Validation → Async Buffer → Batch Processor → PostgreSQL
```

- **Incoming**: SMS and DATA_USAGE events arrive as HTTP POST requests
- **Validated**: Each event is checked against a type schema before storage
- **Buffered**: Events accumulate in an in-memory buffer (flush on `BATCH_SIZE` or `BATCH_INTERVAL_MS`)
- **Batched**: Flushes become bulk `INSERT ... ON CONFLICT DO NOTHING` statements
- **Stored**: PostgreSQL with indexed columns and JSONB payload

## 3. Starting Docker

```bash
docker compose up --build
```

The API starts on `http://localhost:3000` and PostgreSQL on `localhost:5432`.

## 4. Health Check

```bash
curl localhost:3000/health
# {"status":"ok","database":"ok"}
```

Confirms both the service and the database are reachable.

## 5. Event Ingestion

```bash
curl -X POST localhost:3000/api/events \
  -H 'Content-Type: application/json' \
  -d '{"eventId":"demo-001","eventType":"SMS","timestamp":"2026-09-17T10:00:00.000Z","subscriberId":"S1234567A","sourceNumber":"+6591234567","destinationNumber":"+6587654321","messageSize":120,"status":"DELIVERED"}'
# {"accepted":1}
```

Accepts single events or batches (`{"events": [...]}` or a JSON array).

## 6. Benchmark

```bash
npm run benchmark
```

Sends **100,000 events** (batch size 500, concurrency 5). Results:

| Metric | Result |
|---|---|
| Throughput | 52,247 events/sec |
| Duration | 1.91 s |
| Failed requests | 0 |
| Database rows verified | 100,000 |

## 7. PostgreSQL Verification

```bash
docker compose exec db psql -U postgres -d telecom_logs -c "SELECT count(*) FROM telecom_events;"
#  count
# -------
# 100000
```

All 100,000 events are confirmed stored.

## 8. Key Engineering Challenge

PostgreSQL limits prepared statements to **65,535 bound parameters**. With 5 parameters per event row, the `bulkInsert` method automatically chunks large batches into groups of at most 13,107 rows, preventing the `bind message has N parameter formats` error. The `RETURNING` clause was also removed — the service only needs `rowCount`, not the actual row data.

## 9. Tests

```bash
npm test
# 19/19 tests pass
```

Tests use pg-mem (in-memory PostgreSQL), so no external database is required.
