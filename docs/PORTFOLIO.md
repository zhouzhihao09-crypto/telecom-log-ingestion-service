# Featured Projects

Two engineering projects that demonstrate complementary skills: backend systems and performance engineering (Telecom), and AI application and product engineering (Tender AI).

---

## Telecom Log Ingestion Service

A batch-oriented ingestion pipeline for telecom SMS and mobile data usage events. Built with Node.js, Fastify, TypeScript, and PostgreSQL — deployed via Docker Compose.

### What I built

This service accepts telecom event logs over HTTP, validates them at runtime, buffers them in memory, and writes them to PostgreSQL in configurable batches. It is designed for throughput while keeping API latency low through asynchronous buffering.

### Engineering highlights

- **TypeScript + Node.js + Fastify** — typed backend with async event-loop buffering
- **PostgreSQL** — hybrid schema (indexed columns + JSONB), B-tree and GIN indexes, bulk `INSERT ... ON CONFLICT DO NOTHING`
- **Docker** — one-command Compose deployment with automatic schema initialization and health checks
- **Asynchronous buffering** — in-memory buffer flushes on `BATCH_SIZE` (500) or `BATCH_INTERVAL_MS` (100ms)
- **Batch processing** — 100,000 events become 200 bulk INSERTs instead of 100,000 individual queries
- **Idempotency** — `UNIQUE(event_id)` + `ON CONFLICT DO NOTHING` silently drops duplicates from network retries
- **PostgreSQL parameter-limit handling** — automatic chunking of large inserts into 13,107-row groups to stay under the 65,535-parameter limit
- **Automated testing** — 19 tests using pg-mem (in-memory PostgreSQL emulator)

### Benchmark

**Local Docker benchmark** (single host, not production telecom capacity).

| Metric | Result |
|---|---|
| Events | 100,000 |
| Throughput | 52,247 events/sec |
| Failed requests | 0 |
| Database rows verified | 100,000 |

Benchmark results can vary between runs (a subsequent run measured 50,839 events/sec). All runs show 0 failures and 100,000 verified database rows.

### Engineering challenge

PostgreSQL limits prepared statements to 65,535 bound parameters. Since each event row uses 5 parameters, a single `INSERT` cannot safely exceed 13,107 rows. The `bulkInsert` method automatically chunks large flush batches into sub-13,107-row groups, preventing the `bind message has N parameter formats but 0 parameters` error.

### Links

- GitHub: https://github.com/zhouzhihao09-crypto/telecom-log-ingestion-service
- Demo guide: `docs/DEMO.md`

---

## Tender AI

A document-AI workspace for tender intelligence and bid preparation. Built with Python, FastAPI, and PostgreSQL/SQLite — a portfolio project demonstrating an end-to-end document-AI application.

### What I built

Tender AI lets users upload tender PDFs, automatically extracts structured information with page references, match company evidence to tender requirements, track bid preparation progress, and export submission packages as ZIP manifests of evidence.

### Engineering highlights

- **Python + FastAPI** — typed backend with Pydantic models and SQLAlchemy 2.0 ORM
- **Document processing** — PDF validation (header + size), page-level text extraction with `pypdf`, overlapping chunk splitting with page identity
- **AI/LLM integration** — deterministic analysis (regex-based, always available) with optional Ollama LLM (qwen2.5:7b); grounded JSON validation checks LLM results against extracted sources before persistence
- **Evidence retrieval** — lexical search (keyword + hybrid scoring) over chunked documents and evidence vault; conservative "potentially relevant" suggestions that require explicit user linking
- **Bid workspace** — requirement tracking, clarification management, document linking, readiness state, submission package manifest with ZIP export
- **Authentication** — scrypt password hashing with per-user salt, server-side sessions (HMAC token hash, HttpOnly/SameSite=Lax cookies), workspace ownership enforcement on all routes
- **Billing** — Stripe SDK (test mode), checkout, customer portal, webhook-verified subscription lifecycle, idempotent billing events
- **Storage abstraction** — local filesystem or S3-compatible (boto3) with path-traversal protection
- **Background processing** — RQ/Redis when configured (durable jobs with retries); FastAPI BackgroundTasks fallback
- **Security** — security headers, TrustedHost middleware, production fail-safe config validation, body-size limits
- **Migrations** — Alembic versioned migrations (1 baseline covering 30 tables)
- **Docker** — `python:3.12-slim` image with non-root `appuser`
- **Testing** — 177 tests with pytest, using isolated temp databases and filesystems

### Links

- GitHub: https://github.com/zhouzhihao09-crypto/tender-ai
- Demo guide: see `docs/DEMO.md` in the [Tender AI repo](https://github.com/zhouzhihao09-crypto/tender-ai)

### What's NOT implemented (planned)

- OpenAI provider — stub exists in code, not fully wired (planned Phase 15B)
- Structured JSON logging — uvicorn default logs only (planned Phase 15B)
- Multi-worker deployment — single uvicorn process, Gunicorn scaling documented but not configured
- Prometheus metrics — not added
- Rate limiting on auth endpoints — config variables exist but in-process limiter not implemented for production
- Email verification, password reset, team invitations — planned, not implemented
