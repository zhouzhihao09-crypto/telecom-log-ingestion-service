# Screenshots

This directory holds screenshots for the project README and portfolio documentation.

## Screenshots to Capture

To complete the portfolio documentation, capture the following screenshots and save them here with the names listed:

| File | Description |
|---|---|
| `readme-architecture.png` | The Mermaid architecture diagram as rendered on the GitHub README page |
| `docker-containers.png` | `docker compose ps` showing the app and PostgreSQL containers running and healthy |
| `health-check.png` | Terminal output of `curl localhost:3000/health` returning `{"status":"ok","database":"ok"}` |
| `event-ingestion.png` | Terminal output of a `curl -X POST localhost:3000/api/events` request returning `202 Accepted` with the event payload |
| `benchmark-results.png` | Terminal output of `npm run benchmark` showing 100,000 events, 52,247 events/sec, 0 failures |
| `postgres-verification.png` | `docker compose exec db psql -U postgres -d telecom_logs -c "SELECT count(*) FROM telecom_events;"` returning 100,000 |

## How to Capture

1. Start the service: `docker compose up --build`
2. Run the benchmark: `npm run benchmark`
3. Verify the database: `docker compose exec db psql -U postgres -d telecom_logs -c "SELECT count(*) FROM telecom_events;"`
4. Check health: `curl localhost:3000/health`
5. Send a test event: `curl -X POST localhost:3000/api/events ...`
6. View the README on GitHub to confirm the Mermaid diagram renders
7. Save each screenshot with the filename from the table above
