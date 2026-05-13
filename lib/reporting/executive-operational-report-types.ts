/**
 * Deterministic executive operational reports — JSON envelope only (no LLM synthesis).
 * Narratives are template-backed or copied from existing operational-health / timeline fields.
 */

import type { OperationalHealthScoresReport } from "@/lib/aiden/operational-health-score-types"
import type { OperationalTimelineIntelligence, OperationalTimelineRuleId } from "@/lib/aiden/operational-timeline-types"

export const EXECUTIVE_OPERATIONAL_REPORT_SCHEMA_VERSION = "2026-05-12-v1"

export type ExecutiveOperationalCadence = "weekly" | "monthly"

export type ExecutiveOperationalMethodologyEntry = {
  id: string
  title: string
  explanation: string
}

/** Inclusive start, exclusive end — ISO 8601 UTC timestamps. */
export type ExecutiveOperationalTimeWindow = {
  cadence: ExecutiveOperationalCadence
  label: string
  startUtc: string
  endUtc: string
}

export type ExecutiveOperationalFlowByType = {
  repair: number
  pm: number
  inspection: number
  install: number
  emergency: number
  /** Rows whose `type` is null or not one of the buckets above. */
  other: number
  /** Sum of buckets — should equal `totalCreated` when counts are consistent. */
  typedSum: number
  totalCreated: number
  totalCompleted: number
}

export type ExecutiveOperationalBranchSlice = {
  customerLocationId: string
  locationName: string
  workOrdersCreatedInWindow: number
}

export type ExecutiveOperationalTrendRow = {
  metricId: string
  label: string
  currentPeriod: number
  priorPeriod: number
  /** Deterministic comparison: equal counts → flat. */
  direction: "up" | "down" | "flat" | "na"
}

export type ExecutiveOperationalRiskFact = {
  /** Single factual sentence — no probabilistic language. */
  statement: string
  /** Pointer into this report JSON for auditors (JSON Pointer–style path). */
  evidencePath: string
  correlationRuleIds?: OperationalTimelineRuleId[]
}

export type ExecutiveOperationalDispatchSlice = {
  activeWorkOrdersUnassigned: number
  scheduledDatePassedStillActive: number
  maxJobsSameDaySameAssignee: number
  scheduleCongestionExamplesCount: number
  methodologyNote: string
}

export type ExecutiveOperationalPmTrendPoint = {
  weekStartUtc: string
  pm: number
  emergency: number
  inspection: number
  other: number
}

export type ExecutiveOperationalReadinessSummary = {
  headline: string
  industryOperationalPresent: boolean
  /** Verbatim strings from `industryOperational` when present — otherwise empty. */
  bullets: string[]
}

export type ExecutiveOperationalInspectionComplianceSummary = {
  headline: string
  /** Pulled from operational health category `inspection_compliance` when included. */
  categoryScore: number | null
  contributingFactorLabels: string[]
}

export type ExecutiveOperationalReport = {
  schemaVersion: typeof EXECUTIVE_OPERATIONAL_REPORT_SCHEMA_VERSION
  generatedAt: string
  organizationId: string
  organizationName: string | null
  industryRaw: string | null
  industryKey: string
  /** Human sector label from onboarding bundle (context only). */
  industryDisplayLabel: string
  sectorFramingOneLiner: string | null
  cadence: ExecutiveOperationalCadence
  customerLocationId: string | null
  customerLocationName: string | null
  methodology: ExecutiveOperationalMethodologyEntry[]
  currentPeriod: ExecutiveOperationalTimeWindow
  priorPeriod: ExecutiveOperationalTimeWindow
  flowCurrent: ExecutiveOperationalFlowByType
  flowPrior: ExecutiveOperationalFlowByType
  volumeTrends: ExecutiveOperationalTrendRow[]
  branchSlices: ExecutiveOperationalBranchSlice[]
  /** Set when branch ranking used a bounded fetch (deterministic cap). */
  branchRankingRowCap: number | null
  dispatchAtGeneration: ExecutiveOperationalDispatchSlice
  pmAndMixTrends: ExecutiveOperationalPmTrendPoint[]
  readinessSummary: ExecutiveOperationalReadinessSummary
  inspectionComplianceSummary: ExecutiveOperationalInspectionComplianceSummary
  operationalHealthAtGeneration: OperationalHealthScoresReport | null
  timelineIntelligence: OperationalTimelineIntelligence | null
  operationalRiskFacts: ExecutiveOperationalRiskFact[]
  /** Same bounded snapshot object used for health / timeline (minus duplicate if large). */
  operationalSnapshotRef: {
    generatedAt: string
    scope: string
    counts: Record<string, unknown>
  } | null
  limitations: string[]
}

/**
 * Future scheduled delivery — persistence not required for v1.
 * A cron worker would: resolve `timezone` → wall clock → enqueue {@link ExecutiveOperationalReport}
 * and call {@link sendExecutiveOperationalReportEmail} (or queue provider).
 */
export type ExecutiveOperationalReportScheduleCadence = ExecutiveOperationalCadence

export type ExecutiveOperationalReportScheduleDraft = {
  id: string
  organizationId: string
  cadence: ExecutiveOperationalReportScheduleCadence
  /** IANA name, e.g. `America/Chicago` — used only when a scheduler runs. */
  timezone: string
  customerLocationId: string | null
  recipientEmails: string[]
  enabled: boolean
  /** ISO — next execution instant if scheduled. */
  nextRunAtUtc: string | null
}

export type ExecutiveOperationalEmailPayload = {
  subject: string
  htmlBody: string
  textBody: string
  organizationId: string
  cadence: ExecutiveOperationalCadence
}
