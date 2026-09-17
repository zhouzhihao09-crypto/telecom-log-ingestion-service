# Telecom Log Ingestion Service

A high-throughput Node.js/TypeScript service that simulates ingestion of telecom SMS and mobile data usage events. Built with Fastify, PostgreSQL, and Docker.

## What I Built

A complete log ingestion pipeline that accepts, validates, batches, and stores telecom events at high throughput:

- **Fastify ingestion API** — `POST /api/events` accepts single events or batches; `GET /health` reports liveness
- **TypeScript event validation** — runtime type guards ensure SMS and DATA_USAGE events are well-formed before storage
- **Asynchronous in-memory buffering** — events are buffered after acceptance and flushed in the background, keeping API response times low
- **Configurable batch processing** — buffer flushes when `BATCH_SIZE` events accumulate **or** `BATCH_INTERVAL_MS` milliseconds elapse (configurable via env vars)
- **PostgreSQL bulk inserts** — each flush becomes a single `INSERT ... VALUES (...) ON CONFLICT DO NOTHING` statement instead of one query per event
- **Database indexes** — B-tree indexes on `subscriber_id`, `timestamp`, and `(event_type, timestamp)`; GIN index on JSONB `payload`
- **Idempotent event ingestion** — `event_id` has a UNIQUE constraint; duplicates are silently skipped via `ON CONFLICT DO NOTHING`
- **Docker Compose** — one command starts the app and PostgreSQL with automatic schema initialization
- **Automated tests** — 19 tests using pg-mem (in-memory PostgreSQL, no external services needed)
- **Throughput benchmark** — generates configurable event volumes and reports events/sec, latency, and success/failure counts

## Architecture

```
┌──────────────────┐
│  Log Generator   │   scripts/generate-logs.ts
│  or  Benchmark   │   scripts/benchmark.ts
└────────┬─────────┘
         │ HTTP POST /api/events
         ▼
┌──────────────────┐
│  Fastify API     │   src/server.ts, src/routes/ingest.ts
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Event Validation │   src/utils/validate.ts
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Async Buffer    │   src/services/ingestionService.ts
│  [in-memory]     │   Flushes by size OR time
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Batch Processor  │   Bulk INSERT with parameterised query
└────────┬─────────┘
         ▼
┌──────────────────┐
│  PostgreSQL      │   docker-compose.yml
│                  │
│  +--> Indexes    │
│  +--> Queries     │
└──────────────────┘
```

## Performance Benchmark

Environment:

* Docker Compose (Node.js 20 Alpine, PostgreSQL 16 Alpine)
* 100,000 events
* Batch size: 500
* Concurrency: 5

Result:

| Metric                 |            Result |
| ---------------------- | ----------------: |
| Events                 |           100,000 |
| Batches                |               200 |
| Batch size             |               500 |
| Concurrency            |                 5 |
| Successful requests    |               200 |
| Failed requests        |                 0 |
| Duration               |            1.91 s |
| Throughput             | 52,247 events/sec |
| Database rows verified |           100,000 |

This is a **local Docker benchmark** and should not be interpreted as production telecom-scale capacity. Real telecom systems process millions of events per second using distributed infrastructure (see [Scaling Further](#scaling-further)).

### PostgreSQL Parameter Limit & Batch Chunking

PostgreSQL limits a prepared statement (extended protocol) to 65,535 bound parameters. Because each event row in the bulk `INSERT` uses five parameters (`event_id`, `event_type`, `timestamp`, `subscriber_id`, `payload`), a single query can safely hold at most 13,107 rows. The ingestion service therefore **chunks** large flush batches into sub-13,107-row groups before writing to PostgreSQL, keeping every query under the limit.

Additionally, the `INSERT ... RETURNING event_id` clause was removed. Since the service only needs the count of inserted rows (not the actual row data), relying on `rowCount` avoids an unnecessary result set, reducing memory allocation and network round-trip overhead per chunk.

Benchmark results depend on:

- **Hardware** — CPU, disk I/O, and memory affect PostgreSQL write speed
- **Docker configuration** — container resource limits, volume drivers
- **PostgreSQL configuration** — `shared_buffers`, `wal_buffers`, checkpoint settings
- **Batch size** — larger batches reduce query count but increase memory and latency
- **Concurrency** — parallel requests keep the pipeline saturated
- **Workload** — event composition (SMS vs DATA_USAGE) and payload size

## Why Batching?

Without batching, inserting N events requires N separate database queries. Each query involves:

1. Network round-trip to PostgreSQL
2. Query parsing and planning in the database
3. Transaction and WAL (write-ahead log) overhead
4. Index update per row

With batching (e.g., `BATCH_SIZE=500`), those same N events are inserted with N/500 queries. A batch of 500 events becomes **1 database round-trip** instead of 500. This dramatically reduces network overhead and lets PostgreSQL optimise the write path (bulk WAL writes, bulk index updates).

The buffer also decouples the API from the database: the HTTP endpoint returns `202 Accepted` immediately, and the actual insert happens asynchronously. This keeps API latency low even under heavy write load.

## Database Design

The `telecom_events` table uses a **hybrid schema**:

| Column | Type | Purpose |
|---|---|---|
| `id` | `SERIAL PK` | Internal auto-increment primary key |
| `event_id` | `TEXT UNIQUE` | Business event identifier — used for idempotency |
| `event_type` | `TEXT` | `"SMS"` or `"DATA_USAGE"` — indexed with timestamp |
| `timestamp` | `TIMESTAMPTZ` | Event occurrence time — indexed |
| `subscriber_id` | `TEXT` | Subscriber identifier — indexed for telecom queries |
| `payload` | `JSONB` | Event-specific fields (source/dest numbers, bytes used, etc.) |
| `created_at` | `TIMESTAMPTZ` | Ingestion timestamp — defaults to `NOW()` |

### Design decisions

- **Common fields as indexed columns**: Telecom queries almost always filter by `subscriber_id`, `timestamp`, or `event_type`. Storing these in dedicated columns with B-tree indexes enables fast range scans and lookups.
- **Event-specific fields in JSONB**: New event types can be added without schema migrations. The GIN index on `payload` allows querying JSON fields when needed.
- **`event_id` is UNIQUE**: Enforced at the database level. This is the foundation of idempotency.
- **`ON CONFLICT DO NOTHING`**: When a duplicate `event_id` is inserted, PostgreSQL silently skips it rather than raising an error. This handles the real-world scenario where the same event might be delivered multiple times due to network retries.

## Scaling Further

This project demonstrates ingestion concepts on a single machine. A real telecom-scale deployment that processes millions of events per second could evolve this architecture by adding:

1. **A durable message broker** (e.g., Apache Kafka) between the API and the batch processor — decouples ingestion from storage and provides replayability
2. **Multiple ingestion workers** — run several app instances behind a load balancer, each with its own buffer
3. **Horizontal scaling** — partition events by `subscriber_id` hash across multiple database shards
4. **Database partitioning** — partition the `telecom_events` table by `timestamp` (time-based partitioning) for efficient archival and querying
5. **Distributed observability** — OpenTelemetry tracing, Prometheus metrics, and structured logging across all components
6. **Stream processing** — Apache Flink or ksqlDB for real-time analytics on the event stream

> These are **architectural next steps**, not part of the current implementation. This project intentionally keeps things simple to demonstrate the core concepts clearly.

## How to Run

### Prerequisites

- Docker Desktop (with Docker Compose)

### Start the service

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000`.

### Inspect the database

```bash
docker compose exec db psql -U postgres -d telecom_logs -c "SELECT count(*) FROM telecom_events;"
```

### Generate test events

```bash
# Default: 100,000 events, batch size 500
npm run generate

# Custom volume
EVENTS=50000 BATCH_SIZE=200 npm run generate
```

### Run the benchmark

```bash
npm run benchmark
```

### Run tests

```bash
npm test
```

Tests use [pg-mem](https://github.com/oguimbal/pg-mem) — an in-memory PostgreSQL emulator — so no external database is needed.

### Change batch size

Set environment variables in `.env` (local development) or in the `environment` section of `docker-compose.yml`:

| Variable | Default | Description |
|---|---|---|
| `BATCH_SIZE` | `500` | Events per batch before forced flush |
| `BATCH_INTERVAL_MS` | `100` | Max milliseconds between flushes |

## API

### `GET /health`

Returns service and database health:

```json
{ "status": "ok", "database": "ok" }
```

### `POST /api/events`

Accepts a single event, a batch object, or an array:

```bash
# Single event
curl -X POST localhost:3000/api/events \
  -H 'Content-Type: application/json' \
  -d '{"eventId":"sms-001","eventType":"SMS","timestamp":"2026-09-17T10:00:00.000Z","subscriberId":"S1234567A","sourceNumber":"+6591234567","destinationNumber":"+6587654321","messageSize":120,"status":"DELIVERED"}'

# Batch
curl -X POST localhost:3000/api/events \
  -H 'Content-Type: application/json' \
  -d '{"events":[{"eventId":"sms-001",...},{"eventId":"data-001",...}]}'
```

Response (202 Accepted):

```json
{ "accepted": 3 }
```

## License

ISC
