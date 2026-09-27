# Resume — Selected Projects

Concise, resume-ready descriptions for portfolio inclusion.

## Telecom Log Ingestion Service

A batch-oriented log ingestion pipeline that accepts telecom SMS and data usage events over HTTP, validates them, buffers them in memory, and writes them to PostgreSQL in configurable batches.

**Tech stack:** TypeScript, Node.js, Fastify, PostgreSQL, Docker Compose, pg-mem

**Key results:**
- 52,247 events/sec in a local Docker benchmark processing 100,000 events with 0 failures
- 19/19 automated tests passing

**Engineering work:**
- Designed and implemented async in-memory buffering with configurable size/time-based flushing (BATCH_SIZE=500 or BATCH_INTERVAL_MS=100ms), reducing 100,000 individual database round-trips to 200 bulk INSERT statements
- Solved PostgreSQL's 65,535-parameter-per-statement limit by chunking large batch inserts into 13,107-row groups; removed the unnecessary `RETURNING` clause to reduce result-set overhead
- Built idempotent ingestion via `UNIQUE(event_id)` constraint and `ON CONFLICT DO NOTHING` to silently drop duplicates from network retries
- Designed a hybrid PostgreSQL schema (dedicated B-tree columns + JSONB payload with GIN index) for telecom query patterns
- Implemented comprehensive test suite (19 tests) using pg-mem in-memory PostgreSQL — no external database required

> Benchmark is a local Docker result, not production capacity. Results vary between runs (50,839–52,247 events/sec observed).

## Tender AI

A document-AI workspace for tender intelligence and bid preparation. Accepts tender PDFs, extracts structured information with page references, matches company evidence to requirements, tracks bid preparation, and exports submission packages.

**Tech stack:** Python, FastAPI, SQLAlchemy, PostgreSQL/SQLite, Alembic, pypdf, Pydantic, pytest

**Key results:**
- 177 automated tests passing
- Dockerfile with non-root user, health/readiness probes, security headers

**Engineering work:**
- Built document processing pipeline: PDF validation (header + size), page-level text extraction with `pypdf`, overlapping chunk splitting with page identity retention
- Implemented deterministic analysis (regex-based extraction of dates, requirements, risks, clarifications) with optional Ollama LLM integration; added grounding validation to verify LLM claims against extracted sources before persistence
- Designed evidence retrieval using lexical search (keyword + hybrid scoring) over chunked documents; implemented conservative "potentially relevant" suggestions that require explicit user linking (no automatic linking)
- Developed bid workspace: requirement tracking, clarification management, document linking, readiness state, ZIP submission manifest export
- Implemented authentication: scrypt password hashing with per-user salt, server-side sessions with HMAC token hashing, workspace ownership enforcement on all API routes
- Integrated Stripe test-mode billing: checkout, customer portal, webhook-verified subscription lifecycle, idempotent billing events via BillingEvent table
- Added storage abstraction: local filesystem and S3-compatible (boto3) with path-traversal protection
- Implemented optional RQ/Redis background processing with FastAPI BackgroundTasks fallback
- Contributed to production-readiness audit and Alembic migration baseline (30 tables)

> This is a single-machine portfolio project. Production scaling, OpenAI hosted LLM provider, structured logging, metrics, and rate limiting on auth endpoints are documented as future work but not yet implemented.
