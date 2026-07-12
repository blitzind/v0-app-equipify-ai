/**
 * GE-AIOS-CONTACT-1B — Live DataMoon DM discovery types (client-safe).
 */

export const GROWTH_AIOS_CONTACT_1B_QA_MARKER =
  "ge-aios-contact-1b-live-datamoon-dm-discovery-v1" as const

export const DATAMOON_DM_DISCOVERY_PURPOSE = "decision_maker_discovery" as const

export const DATAMOON_DM_DISCOVERY_CRITERIA_VERSION = "contact-1b-v1" as const

/** Bounded polling — no tight loops; resume via AUTONOMY-1B due tick. */
export const DATAMOON_DM_DISCOVERY_POLL_POLICY = {
  /** Minimum gap between polls for the same run. */
  minPollIntervalMs: 30_000,
  /** Temporary error backoff base. */
  temporaryBackoffMs: 60_000,
  /** Cap exponential backoff. */
  maxBackoffMs: 15 * 60_000,
  /** Maximum poll attempts per run before terminal failure. */
  maxPollsPerRun: 40,
  /** Maximum provider age before stale reconciliation. */
  maxProviderAgeMs: 24 * 60 * 60 * 1000,
  /** Soft limit on records fetched for ranking. */
  maxRecordsFetched: 50,
} as const

export type DatamoonDmDiscoveryLifecycleStatus =
  | "requested"
  | "polling"
  | "completed"
  | "failed_retryable"
  | "failed_terminal"
  | "no_result"
  | "duplicate_noop"

export type DatamoonDmDiscoveryRequestInput = {
  organizationId: string
  leadId: string
  companyId?: string | null
  companyName: string | null
  companyDomain: string | null
  titleFamilies: string[]
  filters: Array<{ field: string; operator: string; value: string | string[] }>
  idempotencyKey: string
  geography?: string | null
}

export type DatamoonDmDiscoveryRequestResult = {
  qaMarker: typeof GROWTH_AIOS_CONTACT_1B_QA_MARKER
  status: DatamoonDmDiscoveryLifecycleStatus
  runId: string | null
  audienceId: string | null
  providerCalled: boolean
  reusedExisting: boolean
  nextPollAt: string | null
  message: string
  failureCode: string | null
}

export type DatamoonDmDiscoveryStatusResult = {
  qaMarker: typeof GROWTH_AIOS_CONTACT_1B_QA_MARKER
  status: DatamoonDmDiscoveryLifecycleStatus
  runId: string
  audienceId: string | null
  pollAttemptCount: number
  nextPollAt: string | null
  resultCount: number | null
  message: string
  failureCode: string | null
  readyForFetch: boolean
}

export type DatamoonDmDiscoveryResults = {
  qaMarker: typeof GROWTH_AIOS_CONTACT_1B_QA_MARKER
  status: DatamoonDmDiscoveryLifecycleStatus
  runId: string
  audienceId: string | null
  records: unknown[]
  message: string
  failureCode: string | null
}

/**
 * Canonical live discovery adapter contract (CONTACT-1B).
 * Production resolves the live DataMoon audience adapter; certs inject deterministic doubles.
 */
export type DatamoonDecisionMakerDiscoveryAdapter = {
  requestDiscovery(
    input: DatamoonDmDiscoveryRequestInput,
  ): Promise<DatamoonDmDiscoveryRequestResult>
  getDiscoveryStatus(input: {
    runId: string
    now?: string
  }): Promise<DatamoonDmDiscoveryStatusResult>
  fetchDiscoveryResults(input: {
    runId: string
  }): Promise<DatamoonDmDiscoveryResults>
}

/** Expanded result for the SV1-4 single-shot discovery function shape. */
export type DatamoonDmDiscoveryAdapterResult = {
  records: unknown[]
  providerCalled: boolean
  message: string
  status:
    | "completed"
    | "pending"
    | "failed_retryable"
    | "failed_terminal"
    | "reused"
    | "skipped"
  runId?: string | null
  audienceId?: string | null
  nextPollAt?: string | null
  failureCode?: string | null
  creditsAvoided?: boolean
  adapterKind: "live" | "stub" | "injected"
}
