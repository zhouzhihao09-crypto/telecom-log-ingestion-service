# Screenshots

Manual screenshots to capture for the portfolio presentation. Run commands in **PowerShell**.

## 1. GitHub README / Architecture

**Command:** Open in browser:
```
https://github.com/zhouzhihao09-crypto/telecom-log-ingestion-service
```

**What to show:** Scroll to the **Architecture** section — capture the rendered Mermaid diagram.

**File:** `docs/screenshots/readme-architecture.png`

## 2. Docker Containers (Healthy)

**Command:**
```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"; docker compose ps
```

**What to show:** Both containers `Up ... (healthy)` with port mappings.

**File:** `docs/screenshots/docker-containers.png`

## 3. API Health Check and Event Ingestion

**Commands:**
```powershell
# Health
Invoke-RestMethod -Uri http://localhost:3000/health

# Single event
Invoke-RestMethod -Uri http://localhost:3000/api/events -Method Post -ContentType 'application/json' -Body '{"eventId":"demo-001","eventType":"SMS","timestamp":"2026-09-17T10:00:00.000Z","subscriberId":"S1234567A","sourceNumber":"+6591234567","destinationNumber":"+6587654321","messageSize":120,"status":"DELIVERED"}'

# Batch of 2
Invoke-RestMethod -Uri http://localhost:3000/api/events -Method Post -ContentType 'application/json' -Body '{"events":[{"eventId":"demo-002","eventType":"SMS","timestamp":"2026-09-17T10:00:01.000Z","subscriberId":"S1234567A","sourceNumber":"+6591234567","destinationNumber":"+6587654321","messageSize":95,"status":"DELIVERED"},{"eventId":"demo-003","eventType":"DATA_USAGE","timestamp":"2026-09-17T10:00:02.000Z","subscriberId":"S1234567A","bytesUsed":1048576,"networkType":"5G"}]}'
```

**What to show:** `ok / ok` for health; `{"accepted":1}` and `{"accepted":2}` for ingestion.

**File:** `docs/screenshots/api-demo.png`

## 4. Benchmark Result

**Command:**
```powershell
npx.cmd tsx scripts/benchmark.ts
```

**What to show:** Benchmark output showing 100,000 events, ~50K–52K events/sec, 0 failures.

**File:** `docs/screenshots/benchmark.png`

## 5. PostgreSQL Row Verification

**Command:**
```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"; docker compose exec db psql -U postgres -d telecom_logs -c "SELECT count(*) FROM telecom_events;"
```

**What to show:** 100,003 rows (100,000 from benchmark + 3 from manual test events).

**File:** `docs/screenshots/postgres-verification.png`

## 6. Server Logs (Optional)

**Command:**
```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"; docker logs telecom-ingestion --tail 20
```

**What to show:** Recent log output confirming event acceptance and batch inserts.

**File:** `docs/screenshots/server-logs.png`

## Capture Order

1. README architecture (browser)
2. Start Docker, capture `docker compose ps`
3. Health + ingestion (capture in one terminal window)
4. Run benchmark (capture output)
5. PostgreSQL verification (capture count)
6. (Optional) Server logs

## Cleanup

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"; docker compose down --volumes
```
