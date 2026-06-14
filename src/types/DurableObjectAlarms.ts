/**
 * Represents a scheduled event within the Durable Object storage.
 */
export interface ScheduledAlarmEvent {
  id: "cleanup" | "host_transfer";
  runAt: number;
  repeatMs: number | null;
}
