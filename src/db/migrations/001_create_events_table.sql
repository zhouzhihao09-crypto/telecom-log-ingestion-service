-- Migration: 001 - Create the events table and indexes
-- Creates the telecom_events table with a hybrid schema:
--   common fields as dedicated columns, event-specific fields in JSONB payload.

CREATE TABLE IF NOT EXISTS telecom_events (
    id            SERIAL PRIMARY KEY,
    event_id      TEXT    NOT NULL UNIQUE,
    event_type    TEXT    NOT NULL,
    timestamp     TIMESTAMPTZ NOT NULL,
    subscriber_id TEXT    NOT NULL,
    payload       JSONB   NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_subscriber_id
    ON telecom_events (subscriber_id);

CREATE INDEX IF NOT EXISTS idx_events_timestamp
    ON telecom_events (timestamp);

CREATE INDEX IF NOT EXISTS idx_events_type_timestamp
    ON telecom_events (event_type, timestamp);

CREATE INDEX IF NOT EXISTS idx_events_payload_gin
    ON telecom_events USING GIN (payload);
