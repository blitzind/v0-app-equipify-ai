/** Phase 6.35D — Lemlist / adapter operator surface decommission (client-safe). */

export const GROWTH_LEMLIST_DECOMMISSION_QA_MARKER = "growth-lemlist-decommission-v1" as const

export const GROWTH_ADAPTER_ROLLBACK_SEQUENCE_EXECUTION_HREF =
  "/admin/growth/sequences/execution" as const

export const GROWTH_ADAPTER_LEGACY_QUEUE_ARCHIVE_HREF =
  "/admin/growth/outreach/legacy-queue" as const

export const GROWTH_LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE =
  "Lemlist and outreach_queue execution are rollback-only. Production sends use native Gmail / Microsoft 365 via Sequence Execution." as const

export const GROWTH_LEGACY_OUTREACH_APPROVAL_REDIRECT_NOTE =
  "Legacy outreach approval URLs redirect to Sequence Execution. Historical queue items remain in read-only archive." as const
