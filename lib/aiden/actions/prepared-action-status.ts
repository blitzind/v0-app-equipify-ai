/**
 * Lifecycle status for rows in `public.aiden_prepared_actions` (DB CHECK constraint must stay in sync).
 */
export const AIDEN_PREPARED_ACTION_STATUSES = [
  "prepared",
  "needs_clarification",
  "ready_for_confirmation",
  "confirmed",
  "executing",
  "completed",
  "canceled",
  "failed",
] as const

export type AidenPreparedActionStatus = (typeof AIDEN_PREPARED_ACTION_STATUSES)[number]

export function isAidenPreparedActionStatus(value: string): value is AidenPreparedActionStatus {
  return (AIDEN_PREPARED_ACTION_STATUSES as readonly string[]).includes(value)
}
