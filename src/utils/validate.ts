import { isTelecomEvent, TelecomEvent, EVENT_TYPES } from "../types/events";

export interface ValidationResult<T> {
  valid: true;
  data: T;
}

export interface ValidationFailure {
  valid: false;
  error: string;
  code?: string;
}

export type Validated<T> = ValidationResult<T> | ValidationFailure;

function isValidISOString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

export function validateEvent(raw: unknown): Validated<TelecomEvent> {
  if (typeof raw !== "object" || raw === null) {
    return { valid: false, error: "Event must be a JSON object", code: "INVALID_FORMAT" };
  }

  const event = raw as Record<string, unknown>;

  if (typeof event.eventId !== "string" || event.eventId.length === 0) {
    return { valid: false, error: "eventId is required and must be a non-empty string", code: "INVALID_FIELD" };
  }

  if (typeof event.eventType !== "string" || !EVENT_TYPES.includes(event.eventType as any)) {
    return { valid: false, error: `eventType must be one of: ${EVENT_TYPES.join(", ")}. Received: ${String(event.eventType)}`, code: "INVALID_FIELD" };
  }

  if (!isValidISOString(event.timestamp)) {
    return { valid: false, error: "timestamp must be a valid ISO 8601 string", code: "INVALID_FIELD" };
  }

  if (typeof event.subscriberId !== "string" || event.subscriberId.length === 0) {
    return { valid: false, error: "subscriberId is required and must be a non-empty string", code: "INVALID_FIELD" };
  }

  if (!isTelecomEvent(event)) {
    return { valid: false, error: `Event-specific fields are invalid for eventType ${event.eventType}`, code: "INVALID_FIELD" };
  }

  if (event.eventType === "SMS") {
    if (event.messageSize < 0) {
      return { valid: false, error: "messageSize must be non-negative", code: "INVALID_FIELD" };
    }
  }

  if (event.eventType === "DATA_USAGE") {
    if (event.bytesUsed < 0) {
      return { valid: false, error: "bytesUsed must be non-negative", code: "INVALID_FIELD" };
    }
  }

  return { valid: true, data: event as TelecomEvent };
}

export function validateEventBatch(raw: unknown): Validated<TelecomEvent[]> {
  if (typeof raw !== "object" || raw === null) {
    return { valid: false, error: "Request body must be a JSON object", code: "INVALID_FORMAT" };
  }

  const body = raw as Record<string, unknown>;

  if (!Array.isArray(body.events)) {
    return { valid: false, error: "Request must contain an 'events' array", code: "INVALID_FORMAT" };
  }

  if (body.events.length === 0) {
    return { valid: false, error: "events array must not be empty", code: "INVALID_FORMAT" };
  }

  const validated: TelecomEvent[] = [];

  for (let i = 0; i < body.events.length; i++) {
    const result = validateEvent(body.events[i]);
    if (!result.valid) {
      return {
        valid: false,
        error: `Event at index ${i}: ${result.error}`,
        code: result.code,
      };
    }
    validated.push(result.data);
  }

  return { valid: true, data: validated };
}
