/** Client-safe Growth Engine dogfood validation types (slice 6.26A). */

export const GROWTH_DOGFOOD_VALIDATION_QA_MARKER = "dogfood-validation-v1" as const

export const GROWTH_DOGFOOD_SUBSYSTEMS = [
  "import",
  "outbound",
  "reply",
  "meeting",
  "pipeline",
  "lifecycle",
] as const
export type GrowthDogfoodSubsystem = (typeof GROWTH_DOGFOOD_SUBSYSTEMS)[number]

export const GROWTH_DOGFOOD_VALIDATION_STATUSES = [
  "not_tested",
  "testing",
  "validated",
  "warning",
  "failed",
] as const
export type GrowthDogfoodValidationStatus = (typeof GROWTH_DOGFOOD_VALIDATION_STATUSES)[number]

export const GROWTH_DOGFOOD_ISSUE_SEVERITIES = ["critical", "high", "medium", "low"] as const
export type GrowthDogfoodIssueSeverity = (typeof GROWTH_DOGFOOD_ISSUE_SEVERITIES)[number]

export const GROWTH_DOGFOOD_ISSUE_STATUSES = ["open", "in_progress", "fixed", "wont_fix"] as const
export type GrowthDogfoodIssueStatus = (typeof GROWTH_DOGFOOD_ISSUE_STATUSES)[number]

export const GROWTH_DOGFOOD_INBOX_VIEWS = ["scorecard", "runs", "issues", "blockers"] as const
export type GrowthDogfoodInboxView = (typeof GROWTH_DOGFOOD_INBOX_VIEWS)[number]

export const GROWTH_DOGFOOD_SUBSYSTEM_LABELS: Record<GrowthDogfoodSubsystem, string> = {
  import: "Import",
  outbound: "Outbound",
  reply: "Reply Intelligence",
  meeting: "Meeting & Coaching",
  pipeline: "Pipeline & Forecast",
  lifecycle: "Post-Close Lifecycle",
}

export const GROWTH_DOGFOOD_VALIDATION_STATUS_LABELS: Record<GrowthDogfoodValidationStatus, string> = {
  not_tested: "Not Tested",
  testing: "Testing",
  validated: "Validated",
  warning: "Warning",
  failed: "Failed",
}

export const GROWTH_DOGFOOD_SUBSYSTEM_CHECKS: Record<GrowthDogfoodSubsystem, string[]> = {
  import: ["Seamless CSV import", "Dedupe", "Enrichment", "Assignment"],
  outbound: [
    "Personalization quality",
    "Lemlist delivery",
    "Bounce handling",
    "Unsubscribe handling",
    "Suppression handling",
  ],
  reply: ["Intent classification", "SLA handling", "Owner routing"],
  meeting: ["Google Meet coaching", "Google Voice coaching", "Browser meeting capture"],
  pipeline: ["Opportunity progression", "Forecasting", "Weighted pipeline"],
  lifecycle: ["Onboarding", "Reviews", "Referrals", "Renewal notifications"],
}

export type GrowthDogfoodValidationRun = {
  id: string
  subsystem: GrowthDogfoodSubsystem
  status: GrowthDogfoodValidationStatus
  notes: string
  ownerUserId: string | null
  issueCount: number
  confidence: number
  runAt: string
  createdAt: string
}

export type GrowthDogfoodIssue = {
  id: string
  title: string
  severity: GrowthDogfoodIssueSeverity
  subsystem: GrowthDogfoodSubsystem
  ownerUserId: string | null
  status: GrowthDogfoodIssueStatus
  reproductionNotes: string
  fixedVersion: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export type GrowthDogfoodSubsystemScorecard = {
  subsystem: GrowthDogfoodSubsystem
  label: string
  checks: string[]
  status: GrowthDogfoodValidationStatus
  failures: number
  lastValidatedAt: string | null
  ownerUserId: string | null
  confidence: number
}

export type GrowthDogfoodReadinessDashboard = {
  qaMarker: typeof GROWTH_DOGFOOD_VALIDATION_QA_MARKER
  overallReadinessPercent: number
  subsystemReadiness: Array<{ subsystem: GrowthDogfoodSubsystem; readinessPercent: number; status: GrowthDogfoodValidationStatus }>
  openBlockers: number
  criticalBlockers: number
  readyForBlitzUsage: boolean
  scorecard: GrowthDogfoodSubsystemScorecard[]
}

export type GrowthDogfoodCommandSummary = {
  qaMarker: typeof GROWTH_DOGFOOD_VALIDATION_QA_MARKER
  overallReadinessPercent: number
  openBlockers: number
  criticalBlockers: number
  failedSubsystems: number
  readyForBlitzUsage: boolean
}

export function readinessPercentForStatus(status: GrowthDogfoodValidationStatus): number {
  if (status === "validated") return 100
  if (status === "warning") return 75
  if (status === "testing") return 50
  if (status === "failed") return 0
  return 0
}

export function confidenceForScorecard(input: {
  status: GrowthDogfoodValidationStatus
  openIssueCount: number
  criticalIssueCount: number
}): number {
  let confidence = readinessPercentForStatus(input.status)
  confidence -= Math.min(30, input.openIssueCount * 5)
  confidence -= Math.min(40, input.criticalIssueCount * 15)
  return Math.max(0, Math.min(100, confidence))
}

export function computeOverallReadiness(
  scorecard: Array<{ status: GrowthDogfoodValidationStatus }>,
): number {
  if (scorecard.length === 0) return 0
  const total = scorecard.reduce((sum, entry) => sum + readinessPercentForStatus(entry.status), 0)
  return Math.round(total / scorecard.length)
}

export function isReadyForBlitzUsage(input: {
  scorecard: Array<{ status: GrowthDogfoodValidationStatus }>
  criticalBlockers: number
}): boolean {
  if (input.criticalBlockers > 0) return false
  return input.scorecard.every((entry) => entry.status === "validated" || entry.status === "warning")
}

export function buildGrowthDogfoodScorecard(input: {
  latestRuns: Map<
    GrowthDogfoodSubsystem,
    { status: GrowthDogfoodValidationStatus; runAt: string; ownerUserId: string | null; confidence: number }
  >
  issueCounts: Map<GrowthDogfoodSubsystem, { open: number; critical: number }>
}): GrowthDogfoodSubsystemScorecard[] {
  return GROWTH_DOGFOOD_SUBSYSTEMS.map((subsystem) => {
    const latest = input.latestRuns.get(subsystem)
    const issues = input.issueCounts.get(subsystem) ?? { open: 0, critical: 0 }
    const status = latest?.status ?? ("not_tested" as GrowthDogfoodValidationStatus)
    return {
      subsystem,
      label: GROWTH_DOGFOOD_SUBSYSTEM_LABELS[subsystem],
      checks: GROWTH_DOGFOOD_SUBSYSTEM_CHECKS[subsystem],
      status,
      failures: issues.open,
      lastValidatedAt: latest?.runAt ?? null,
      ownerUserId: latest?.ownerUserId ?? null,
      confidence: confidenceForScorecard({
        status,
        openIssueCount: issues.open,
        criticalIssueCount: issues.critical,
      }),
    }
  })
}
