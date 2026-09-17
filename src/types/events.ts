export const EVENT_TYPES = ["SMS", "DATA_USAGE"] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface BaseEvent {
  eventId: string;
  eventType: EventType;
  timestamp: string;
  subscriberId: string;
}

export interface SmsPayload {
  sourceNumber: string;
  destinationNumber: string;
  messageSize: number;
  status: string;
}

export interface DataUsagePayload {
  bytesUsed: number;
  networkType: string;
}

export interface SmsEvent extends BaseEvent {
  eventType: "SMS";
  sourceNumber: string;
  destinationNumber: string;
  messageSize: number;
  status: string;
}

export interface DataUsageEvent extends BaseEvent {
  eventType: "DATA_USAGE";
  bytesUsed: number;
  networkType: string;
}

export type TelecomEvent = SmsEvent | DataUsageEvent;

export interface EventBatch {
  events: TelecomEvent[];
}

export function isSmsEvent(event: any): event is SmsEvent {
  return (
    event.eventType === "SMS" &&
    typeof event.sourceNumber === "string" &&
    typeof event.destinationNumber === "string" &&
    typeof event.messageSize === "number" &&
    typeof event.status === "string"
  );
}

export function isDataUsageEvent(event: any): event is DataUsageEvent {
  return (
    event.eventType === "DATA_USAGE" &&
    typeof event.bytesUsed === "number" &&
    typeof event.networkType === "string"
  );
}

export function isTelecomEvent(event: any): event is TelecomEvent {
  return isSmsEvent(event) || isDataUsageEvent(event);
}

export function splitEventFields(event: TelecomEvent): {
  common: { event_id: string; event_type: string; timestamp: string; subscriber_id: string };
  payload: Record<string, unknown>;
} {
  const { eventId, eventType, timestamp, subscriberId, ...eventSpecific } = event;
  return {
    common: {
      event_id: eventId,
      event_type: eventType,
      timestamp,
      subscriber_id: subscriberId,
    },
    payload: eventSpecific,
  };
}
