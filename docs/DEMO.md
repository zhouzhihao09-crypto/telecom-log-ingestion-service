# Demo Walkthrough

A practical 60–90 second demonstration of the Telecom Log Ingestion Service.

## Prerequisites

- Docker Desktop running
- PowerShell (Windows) or any terminal
- This project checked out locally

## Step 1: Open the Project

Open the project folder and the GitHub repo side by side:

- Local: `C:\Users\zhiha\OneDrive - Ngee Ann Polytechnic\Desktop\real world problems\Telecom Log Ingestion Service`
- GitHub: `https://github.com/zhouzhihao09-crypto/telecom-log-ingestion-service`

## Step 2: Start Docker

**Command:**
```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"; docker compose up --build
```

**What to show:** Both containers start and become healthy:
```
Container telecom-postgres  Up ... (healthy)
Container telecom-ingestion Up ... (healthy)
```

**What to say:** "One command starts both PostgreSQL and the Fastify API. The database initializes automatically with the schema."

## Step 3: Health Check

**Command:**
```powershell
Invoke-RestMethod -Uri http://localhost:3000/health
```

**What to show:**
```
status  database
------  --------
ok      ok
```

**What to say:** "The health endpoint confirms both the service and database are reachable."

## Step 4: Event Ingestion (Single + Batch)

**Command (single event):**
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/events -Method Post -ContentType 'application/json' -Body '{"eventId":"demo-001","eventType":"SMS","timestamp":"2026-09-17T10:00:00.000Z","subscriberId":"S1234567A","sourceNumber":"+6591234567","destinationNumber":"+6587654321","messageSize":120,"status":"DELIVERED"}'
```

**Command (batch of 2):**
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/events -Method Post -ContentType 'application/json' -Body '{"events":[{"eventId":"demo-002","eventType":"SMS","timestamp":"2026-09-17T10:00:01.000Z","subscriberId":"S1234567A","sourceNumber":"+6591234567","destinationNumber":"+6587654321","messageSize":95,"status":"DELIVERED"},{"eventId":"demo-003","eventType":"DATA_USAGE","timestamp":"2026-09-17T10:00:02.000Z","subscriberId":"S1234567A","bytesUsed":1048576,"networkType":"5G"}]}'
```

**What to show:** Both return `202 Accepted` with `{"accepted": N}`.

**What to say:** "Events are validated, buffered asynchronously, and written to PostgreSQL in batches. The API returns 202 Accepted immediately — the insert happens in the background."

## Step 5: Benchmark

**Command:**
```powershell
npx.cmd tsx scripts/benchmark.ts
```

**What to show:** The final result table:
```
=== Benchmark Results ===
Events: 100000
Batches: 200
Duration: ~1.91 seconds
Throughput: ~52,247 events/sec
Failed requests: 0
```

**What to say:** "This is a **local Docker benchmark** — 100,000 events at 52K per second with zero failures. Not production telecom capacity — that requires distributed infrastructure."

## Step 6: PostgreSQL Verification

**Command:**
```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"; docker compose exec db psql -U postgres -d telecom_logs -c "SELECT count(*) FROM telecom_events;"
```

**What to show:** 100,003 rows (100,000 from benchmark + 3 from the manual tests).

**What to say:** "All 100,000 events are confirmed in PostgreSQL — no data loss."

## Step 7: Key Engineering Challenge

**What to say:** "Events are validated, buffered asynchronously, and written to PostgreSQL in batches."

"Large inserts can exceed PostgreSQL's parameter limit — PostgreSQL limits prepared statements to 65,535 bound parameters. Since each event row uses 5 parameters, a single INSERT can't safely exceed 13,107 rows. I implemented safe chunking in the `bulkInsert` method, which automatically splits large batches into sub-13,107-row groups."

"I also removed the `RETURNING` clause — the service only needs the count of inserted rows (via `rowCount`), not the actual row data, so skipping the result set reduces memory and network overhead."

## Step 8: Tests (Optional, if time permits)

**Command:**
```powershell
npm.cmd test
```

**What to show:** "19/19 tests pass."

**What to say:** "Tests use pg-mem — an in-memory PostgreSQL emulator, so no external database is needed."

## Cleanup

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"; docker compose down --volumes
```
