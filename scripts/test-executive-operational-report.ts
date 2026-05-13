/**
 * Smoke tests for executive operational reporting (no DB).
 */
import assert from "node:assert/strict"
import { computeNextUtcRunAt } from "../lib/reporting/executive-operational-schedule-draft"
import { EXECUTIVE_OPERATIONAL_REPORT_SCHEMA_VERSION } from "../lib/reporting/executive-operational-report-types"
import { renderExecutiveOperationalReportHtml } from "../lib/reporting/executive-operational-report-html"

const sampleReport = {
  schemaVersion: EXECUTIVE_OPERATIONAL_REPORT_SCHEMA_VERSION,
  generatedAt: "2026-05-12T12:00:00.000Z",
  organizationId: "00000000-0000-4000-8000-000000000001",
  organizationName: "Demo Org",
  industryRaw: "hvac_r",
  industryKey: "hvac_r",
  industryDisplayLabel: "HVAC-R",
  sectorFramingOneLiner: "Field service operations",
  cadence: "weekly" as const,
  customerLocationId: null,
  customerLocationName: null,
  methodology: [{ id: "METH.TEST", title: "Test", explanation: "Fixture" }],
  currentPeriod: {
    cadence: "weekly" as const,
    label: "Last 7 days",
    startUtc: "2026-05-05T12:00:00.000Z",
    endUtc: "2026-05-12T12:00:00.000Z",
  },
  priorPeriod: {
    cadence: "weekly" as const,
    label: "Prior 7 days",
    startUtc: "2026-04-28T12:00:00.000Z",
    endUtc: "2026-05-05T12:00:00.000Z",
  },
  flowCurrent: {
    repair: 1,
    pm: 2,
    inspection: 0,
    install: 0,
    emergency: 1,
    other: 0,
    typedSum: 4,
    totalCreated: 4,
    totalCompleted: 3,
  },
  flowPrior: {
    repair: 0,
    pm: 1,
    inspection: 1,
    install: 0,
    emergency: 0,
    other: 0,
    typedSum: 2,
    totalCreated: 2,
    totalCompleted: 2,
  },
  volumeTrends: [
    {
      metricId: "wo_created_total",
      label: "Work orders created (all types)",
      currentPeriod: 4,
      priorPeriod: 2,
      direction: "up" as const,
    },
  ],
  branchSlices: [
    {
      customerLocationId: "00000000-0000-4000-8000-000000000002",
      locationName: "Main site",
      workOrdersCreatedInWindow: 3,
    },
  ],
  branchRankingRowCap: null,
  dispatchAtGeneration: {
    activeWorkOrdersUnassigned: 1,
    scheduledDatePassedStillActive: 0,
    maxJobsSameDaySameAssignee: 4,
    scheduleCongestionExamplesCount: 1,
    methodologyNote: "Snapshot dispatch slice.",
  },
  pmAndMixTrends: [
    { weekStartUtc: "2026-05-04", pm: 1, emergency: 0, inspection: 0, other: 2 },
  ],
  readinessSummary: {
    headline: "Readiness",
    industryOperationalPresent: true,
    bullets: ["Line A", "Line B"],
  },
  inspectionComplianceSummary: {
    headline: "Inspection compliance",
    categoryScore: 72,
    contributingFactorLabels: ["Inspection-type jobs past scheduled date (active)"],
  },
  operationalHealthAtGeneration: {
    generatedAt: "2026-05-12T12:00:00.000Z",
    industryKey: "hvac_r",
    overallScore: 70,
    overallBand: "stable",
    overallLabel: "Stable",
    overallSummary: "Weighted rollup from bounded indices.",
    categories: [],
    weightsUsed: {} as never,
    methodologyNote: "Deterministic indices only.",
    limitations: [],
  },
  timelineIntelligence: null,
  operationalRiskFacts: [
    { statement: "1 active work order(s) have no assigned user or technician.", evidencePath: "/counts/activeWorkOrdersUnassigned" },
  ],
  operationalSnapshotRef: {
    generatedAt: "2026-05-12T12:00:00.000Z",
    scope: "organization",
    counts: {},
  },
  limitations: [],
}

const next = computeNextUtcRunAt({
  from: new Date("2026-05-12T10:00:00.000Z"),
  weekdayUtc: 1,
  hourUtc: 7,
  minuteUtc: 0,
})
assert.match(next, /^2026-05-18T07:00:00\.000Z$/)

const html = renderExecutiveOperationalReportHtml(sampleReport)
assert.ok(html.includes("Weekly executive operational report"))
assert.ok(html.includes("&lt;") === false)
assert.ok(html.includes("<script") === false)

console.info("executive-operational-report tests passed")
