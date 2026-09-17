# Resume Wording

Concise, resume-ready bullets for the Telecom Log Ingestion Service.

## Summary

A batch-oriented log ingestion pipeline that accepts telecom SMS and data usage events over HTTP, validates them, buffers them in memory, and writes them to PostgreSQL in configurable batches — demonstrating systems engineering fundamentals: async I/O, bulk database writes, idempotency, and parameter-limit handling.

## Key Results

- **52,247 events/sec** in a local Docker benchmark processing 100,000 events with 0 failures
- 19/19 automated tests passing

## Technical Skills Demonstrated

| Skill | Details |
|---|---|
| **TypeScript** | Full backend in TypeScript with strict type guards for event validation |
| **Node.js** | Async event loop handling — API returns `202 Accepted` immediately while inserts proceed in the background |
| **Fastify** | HTTP API framework for `GET /health` and `POST /api/events` endpoints |
| **PostgreSQL** | Hybrid schema (indexed columns + JSONB payload), B-tree and GIN indexes, `ON CONFLICT DO NOTHING` for idempotency |
| **Docker** | Docker Compose setup with automatic schema initialization and health checks |
| **Asynchronous buffering** | In-memory buffer decouples API response time from database write latency; flushes on size (`BATCH_SIZE=500`) or time (`BATCH_INTERVAL_MS=100`) |
| **Batch processing** | Each buffer flush becomes a single bulk `INSERT` statement; 100,000 events = 200 round-trips instead of 100,000 |
| **Idempotency** | `event_id` with `UNIQUE` constraint + `ON CONFLICT DO NOTHING` silently drops duplicates from network retries |
| **PostgreSQL parameter-limit handling** | Automatic chunking of large inserts to stay under the 65,535-parameter-per-statement limit (max 13,107 rows per chunk with 5 params/row) |
| **Automated testing** | 19 tests using pg-mem (in-memory PostgreSQL emulator), covering health, ingestion, validation, batching, and idempotency |

## Resume Bullet Points

- Built a batch-oriented telecom log ingestion service (Node.js, Fastify, TypeScript, PostgreSQL) that processed 100,000 events at 52,247 events/sec in a local Docker benchmark with 0 failures
- Implemented an async in-memory buffer with configurable size and time-based flushing (500 events or 100ms), reducing 100,000 individual database round-trips to 200 bulk INSERT statements
- Solved the PostgreSQL 65,535-parameter-per-statement limit by chunking large batch inserts into 13,107-row groups, and removed the unnecessary `RETURNING` clause to reduce result-set overhead
- Designed a hybrid PostgreSQL schema (indexed columns + JSONB payload with B-tree and GIN indexes) and idempotent ingestion via `ON CONFLICT DO NOTHING` for duplicate event handling
- Wrote 19 automated tests using pg-mem (in-memory PostgreSQL) covering validation, batching, idempotency, and health checks — all passing without an external database

> This is a **local Docker benchmark**, not production telecom capacity.
