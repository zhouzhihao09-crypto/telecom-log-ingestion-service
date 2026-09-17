-- init-db.sql
-- Database initialization script for the Telecom Log Ingestion Service
-- This script is automatically executed by Docker's PostgreSQL entrypoint.
-- It creates the events table and all required indexes.

-- ============================================================
-- Schema Design Decision
-- ============================================================
-- The events table uses a hybrid approach:
--   - Common columns (event_id, event_type, timestamp, subscriber_id)
--     are stored as dedicated columns for efficient querying and indexing.
--   - Event-specific fields are stored in a JSONB column called `payload`.
--
-- Why JSONB?
--   - Flexibility: new event types can be added without schema migrations
--   - Queryability: PostgreSQL supports GIN indexes on JSONB for fast lookups
--     on event-specific fields (e.g., payload->>'networkType')
--   - Storage efficiency: only fields that exist are stored
--
-- Why dedicated columns for subscriber_id?
--   - Telecom queries almost always filter by subscriber_id
--   - A dedicated B-tree index on subscriber_id is faster than a GIN index
--   - This is the "hot path" for most operational queries
-- ============================================================

CREATE TABLE IF NOT EXISTS telecom_events (
    id            SERIAL PRIMARY KEY,
    event_id      TEXT    NOT NULL UNIQUE,
    event_type    TEXT    NOT NULL,
    timestamp     TIMESTAMPTZ NOT NULL,
    subscriber_id TEXT    NOT NULL,
    payload       JSONB   NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on event_id (for lookups and idempotency checks)
-- The UNIQUE constraint already creates an index, but we document it here.

-- Index on subscriber_id (for subscriber-level queries, e.g. "show me all
-- events for subscriber S1234567A")
CREATE INDEX IF NOT EXISTS idx_events_subscriber_id
    ON telecom_events (subscriber_id);

-- Index on timestamp (for time-range queries, e.g. "events from the last hour")
CREATE INDEX IF NOT EXISTS idx_events_timestamp
    ON telecom_events (timestamp);

-- Composite index on (event_type, timestamp) for queries like
-- "all SMS events in the last 10 minutes" or "all DATA_USAGE events yesterday"
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp
    ON telecom_events (event_type, timestamp);

-- GIN index on payload for querying event-specific JSON fields
-- (e.g. WHERE payload->>'networkType' = '5G')
CREATE INDEX IF NOT EXISTS idx_events_payload_gin
    ON telecom_events USING GIN (payload);
