/** Client-safe inbox runtime stability + honest empty-state helpers. */

export const GROWTH_INBOX_RUNTIME_STABLE_QA_MARKER = "growth-inbox-runtime-stable-v2" as const
export const GROWTH_INBOX_NO_RUNTIME_ERRORS_QA_MARKER = "growth-inbox-no-runtime-errors-v1" as const
export const GROWTH_INBOX_HONEST_EMPTY_STATE_QA_MARKER = "growth-inbox-honest-empty-state-v2" as const

export type GrowthInboxSetupPhase =
  | "ready"
  | "no_mailbox_providers"
  | "sync_not_configured"
  | "no_sync_runs"
  | "no_threads"

export type GrowthInboxSetupEmptyState = {
  phase: GrowthInboxSetupPhase
  title: string
  message: string
  actions: string[]
}

export function resolveGrowthInboxSetupPhase(input: {
  threadCount: number
  syncRunCount: number
  mailboxConnectionCount: number | null
  syncSchemaReady?: boolean
}): GrowthInboxSetupPhase {
  if (input.threadCount > 0) return "ready"
  if (input.mailboxConnectionCount === 0) return "no_mailbox_providers"
  if (input.syncSchemaReady === false) return "sync_not_configured"
  if (input.syncRunCount === 0) return "no_sync_runs"
  return "no_threads"
}

export function buildGrowthInboxSetupEmptyState(phase: GrowthInboxSetupPhase): GrowthInboxSetupEmptyState | null {
  switch (phase) {
    case "ready":
      return null
    case "no_mailbox_providers":
      return {
        phase,
        title: "No mailbox providers connected",
        message: "Connect a mailbox provider before inbox sync can ingest messages.",
        actions: ["Connect provider to begin ingestion", "Manual thread creation remains available after leads exist"],
      }
    case "sync_not_configured":
      return {
        phase,
        title: "Inbox sync not configured",
        message: "Mailbox sync migrations or provider wiring are not ready on this project.",
        actions: ["Apply inbox sync migrations", "Reload PostgREST schema cache", "Connect provider to begin ingestion"],
      }
    case "no_sync_runs":
      return {
        phase,
        title: "No sync runs yet",
        message: "Mailboxes may be connected, but no inbox sync run has completed.",
        actions: ["Run inbox sync from cron or platform API", "Connect provider to begin ingestion"],
      }
    case "no_threads":
      return {
        phase,
        title: "No inbox threads yet",
        message: "Inbox infrastructure is connected, but no threads have been created or imported.",
        actions: ["Create a thread manually", "Run inbox sync after provider connection"],
      }
  }
}

export function shouldShowGrowthInboxHonestEmptyState(input: {
  threadCount: number
  syncRunCount: number
  mailboxConnectionCount: number | null
  syncSchemaReady?: boolean
}): boolean {
  return resolveGrowthInboxSetupPhase(input) !== "ready"
}
