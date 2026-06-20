/** GS-RG-2B — Dynamic Audience Snapshots config (client-safe). */

export const GROWTH_AUDIENCE_QA_MARKER = "growth-dynamic-audiences-gs-rg-2b-v1" as const

export const GROWTH_AUDIENCE_SCHEMA_MIGRATION =
  "20270901140000_growth_dynamic_audiences_gs_rg_2a.sql" as const

export const GROWTH_AUDIENCE_2B_SCHEMA_MIGRATION =
  "20270901150000_growth_dynamic_audiences_gs_rg_2b.sql" as const

/** Informational only — never auto-executes. */
export const GROWTH_AUDIENCE_REFRESH_POLICIES = ["manual", "daily", "weekly"] as const

export type GrowthAudienceRefreshPolicy = (typeof GROWTH_AUDIENCE_REFRESH_POLICIES)[number]

export const GROWTH_AUDIENCE_RESULT_MODES = ["companies", "people"] as const

export type GrowthAudienceResultMode = (typeof GROWTH_AUDIENCE_RESULT_MODES)[number]

export const GROWTH_AUDIENCE_REFRESH_RUN_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "throttled",
] as const

export type GrowthAudienceRefreshRunStatus = (typeof GROWTH_AUDIENCE_REFRESH_RUN_STATUSES)[number]

export const GROWTH_AUDIENCE_DIFF_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "throttled",
] as const

export type GrowthAudienceDiffStatus = (typeof GROWTH_AUDIENCE_DIFF_STATUSES)[number]

export const GROWTH_AUDIENCE_MEMBER_DIFF_KINDS = ["added", "removed"] as const

export type GrowthAudienceMemberDiffKind = (typeof GROWTH_AUDIENCE_MEMBER_DIFF_KINDS)[number]

/** Hard caps — every audience operation must answer guardrail questions before shipping. */
export const GROWTH_AUDIENCE_LIMITS = {
  MAX_AUDIENCE_MEMBERS_PER_SNAPSHOT: 10_000,
  MAX_AUDIENCE_REFRESHES_PER_DAY: 20,
  MAX_AUDIENCE_GENERATIONS_PER_HOUR: 10,
  MAX_AUDIENCE_ENROLLMENTS_PER_RUN: 100,
  MAX_AUDIENCE_ENROLLMENTS_PER_DAY: 500,
  MAX_AUDIENCE_DIFF_MEMBERS: 10_000,
  MAX_AUDIENCE_REFRESH_BATCH: 500,
  MAX_AUDIENCE_LEAD_CREATIONS_PER_RUN: 100,
  MAX_AUDIENCE_LEAD_CREATIONS_PER_DAY: 500,
  /** Search page size per batch — never load all results. */
  SNAPSHOT_SEARCH_PAGE_SIZE: 500,
  /** Member insert chunk size per batch write. */
  SNAPSHOT_MEMBER_INSERT_BATCH: 200,
  /** Diff key load / persist chunk size. */
  DIFF_MEMBER_BATCH: 500,
  /** Max search pages processed per single API invocation. */
  SNAPSHOT_PAGES_PER_REQUEST: 1,
} as const

export const GROWTH_AUDIENCE_REFRESH_POLICY_INTERVALS: Record<
  Exclude<GrowthAudienceRefreshPolicy, "manual">,
  number
> = {
  daily: 1,
  weekly: 7,
}

export function resolveRefreshIntervalDays(policy: GrowthAudienceRefreshPolicy): number | null {
  if (policy === "manual") return null
  return GROWTH_AUDIENCE_REFRESH_POLICY_INTERVALS[policy]
}

export function computeSuggestedNextRefreshAt(
  policy: GrowthAudienceRefreshPolicy,
  fromDate = new Date(),
): string | null {
  const days = resolveRefreshIntervalDays(policy)
  if (!days) return null
  const next = new Date(fromDate)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString()
}

export function normalizeAudienceRefreshPolicy(raw: string | null | undefined): GrowthAudienceRefreshPolicy {
  if (raw === "daily" || raw === "weekly") return raw
  return "manual"
}

export function estimateAudienceSnapshotBatches(memberCount: number): {
  searchPages: number
  memberInsertBatches: number
} {
  const pageSize = GROWTH_AUDIENCE_LIMITS.SNAPSHOT_SEARCH_PAGE_SIZE
  const insertBatch = GROWTH_AUDIENCE_LIMITS.SNAPSHOT_MEMBER_INSERT_BATCH
  const capped = Math.min(memberCount, GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_MEMBERS_PER_SNAPSHOT)
  return {
    searchPages: Math.ceil(capped / pageSize),
    memberInsertBatches: Math.ceil(capped / insertBatch),
  }
}
