/**
 * GE-AIOS-MULTI-LEAD-INTAKE-1A — Reconciliation math and report assembly certification.
 * Run: pnpm test:ge-aios-multi-lead-intake-1a
 */
import assert from "node:assert/strict"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assembleMultiLeadIntakeValidationReport,
  assessMultiLeadIntakeScaleReadiness,
  computeBatchAccounting,
  computeExecutiveVerdict,
  GROWTH_AIOS_MULTI_LEAD_INTAKE_1A_QA_MARKER,
  type MultiLeadIntakeCompanyRow,
  type MultiLeadIntakePreflightState,
} from "@/lib/growth/training/multi-lead-intake-production-validation-1a"

function row(partial: Partial<MultiLeadIntakeCompanyRow>): MultiLeadIntakeCompanyRow {
  return {
    providerCompanyId: null,
    companyName: null,
    domain: null,
    country: null,
    state: null,
    industryEvidence: null,
    sourceAudienceId: null,
    sourceRunId: null,
    prospectSourceId: null,
    recordStatus: null,
    pushOutcome: "pushed",
    admissionOutcome: "review",
    admissionReasons: [],
    leadId: null,
    organizationId: null,
    normalizedIndependently: true,
    researchRunId: null,
    researchStatus: "none",
    operatorPackageReady: false,
    createdAt: null,
    failureReason: null,
    ...partial,
  }
}

function samplePreflight(
  overrides?: Partial<MultiLeadIntakePreflightState>,
): MultiLeadIntakePreflightState {
  return {
    capturedAt: "2026-07-19T12:00:00.000Z",
    idempotencyKey: "ge-aios-multi-lead-intake-1a-test",
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    activeLeadCount: 12,
    outboundKillSwitchEnabled: false,
    autonomyEnabled: true,
    portfolio: {
      targetActiveCompanies: 25,
      eligibleActive: 20,
      healthState: "healthy",
      shouldReplenish: true,
      batchSize: 5,
      replenishmentReason: null,
    },
    recentAutonomousRuns: [],
    existingProviderDomains: [],
    ...overrides,
  }
}

function testBatchAccountingBalances() {
  const rows = [
    row({ admissionOutcome: "admitted", pushOutcome: "pushed", leadId: "a" }),
    row({ admissionOutcome: "review", pushOutcome: "pushed", leadId: "b" }),
    row({ admissionOutcome: "review", pushOutcome: "pushed", leadId: "c" }),
    row({ admissionOutcome: "duplicate", pushOutcome: "already_exists" }),
    row({ admissionOutcome: "failed", pushOutcome: "failed", failureReason: "invalid" }),
  ]
  const accounting = computeBatchAccounting(rows)
  assert.equal(accounting.providerRecordsReturned, 5)
  assert.equal(accounting.balances, true)
  assert.equal(accounting.unexplained, 0)
}

function testDuplicateRejectedReviewAdmittedFailedAccounting() {
  const rows = [
    row({ admissionOutcome: "admitted", leadId: "lead-1" }),
    row({ admissionOutcome: "review", leadId: "lead-2" }),
    row({ admissionOutcome: "rejected", pushOutcome: "suppressed", failureReason: "keyword" }),
    row({ admissionOutcome: "duplicate", pushOutcome: "already_exists" }),
    row({ admissionOutcome: "failed", pushOutcome: "failed", failureReason: "invalid domain" }),
  ]
  const accounting = computeBatchAccounting(rows)
  assert.equal(accounting.admitted, 1)
  assert.equal(accounting.review, 1)
  assert.equal(accounting.rejected, 1)
  assert.equal(accounting.duplicates, 1)
  assert.equal(accounting.failed, 1)
  assert.equal(accounting.balances, true)
  assert.equal(accounting.persisted, 2)
}

function testSilentlyLostRecordsBreakBalance() {
  const rows = [
    row({ admissionOutcome: "admitted", leadId: "lead-1" }),
    row({ admissionOutcome: "pending", pushOutcome: "pushed" }),
  ]
  const accounting = computeBatchAccounting(rows)
  assert.equal(accounting.unexplained, 1)
  assert.equal(accounting.balances, false)
}

function testExecutivePassRequiresAllCriteria() {
  const accounting = computeBatchAccounting([
    row({ admissionOutcome: "admitted", leadId: "1", pushOutcome: "pushed" }),
    row({ admissionOutcome: "admitted", leadId: "2", pushOutcome: "pushed" }),
    row({ admissionOutcome: "review", leadId: "3", pushOutcome: "pushed" }),
  ])
  const result = computeExecutiveVerdict({
    batchAccounting: accounting,
    distinctAdmittedLeads: 3,
    idempotentPass: true,
    outboundDisabled: true,
    multipleProviderCompanies: true,
    incorrectlyCollapsed: false,
  })
  assert.equal(result.verdict, "PASS")
}

function testExecutivePassWithLimitationsBelowThreeAdmitted() {
  const accounting = computeBatchAccounting([
    row({ admissionOutcome: "admitted", leadId: "1" }),
    row({ admissionOutcome: "admitted", leadId: "2" }),
  ])
  const result = computeExecutiveVerdict({
    batchAccounting: accounting,
    distinctAdmittedLeads: 2,
    idempotentPass: true,
    outboundDisabled: true,
    multipleProviderCompanies: true,
    incorrectlyCollapsed: false,
  })
  assert.equal(result.verdict, "PASS WITH LIMITATIONS")
  assert.match(result.reasons.join(" "), /Only 2 distinct admitted leads/)
}

function testExecutiveFailWhenOutboundNotDisabled() {
  const accounting = computeBatchAccounting([
    row({ admissionOutcome: "admitted", leadId: "1" }),
    row({ admissionOutcome: "admitted", leadId: "2" }),
    row({ admissionOutcome: "admitted", leadId: "3" }),
  ])
  const result = computeExecutiveVerdict({
    batchAccounting: accounting,
    distinctAdmittedLeads: 3,
    idempotentPass: true,
    outboundDisabled: false,
    multipleProviderCompanies: true,
    incorrectlyCollapsed: false,
  })
  assert.equal(result.verdict, "FAIL")
  assert.match(result.reasons.join(" "), /Outbound kill switch was not disabled/)
}

function testExecutiveFailWhenIdempotentRerunCreatesDuplicates() {
  const accounting = computeBatchAccounting([
    row({ admissionOutcome: "admitted", leadId: "1" }),
    row({ admissionOutcome: "admitted", leadId: "2" }),
    row({ admissionOutcome: "admitted", leadId: "3" }),
  ])
  const result = computeExecutiveVerdict({
    batchAccounting: accounting,
    distinctAdmittedLeads: 3,
    idempotentPass: false,
    outboundDisabled: true,
    multipleProviderCompanies: true,
    incorrectlyCollapsed: false,
  })
  assert.equal(result.verdict, "FAIL")
  assert.match(result.reasons.join(" "), /Idempotent rerun created duplicate leads/)
}

function testExecutiveFailWhenSilentlyLostRecords() {
  const accounting = computeBatchAccounting([
    row({ admissionOutcome: "admitted", leadId: "1" }),
    row({ admissionOutcome: "pending", pushOutcome: "pushed" }),
  ])
  const result = computeExecutiveVerdict({
    batchAccounting: accounting,
    distinctAdmittedLeads: 1,
    idempotentPass: true,
    outboundDisabled: true,
    multipleProviderCompanies: true,
    incorrectlyCollapsed: false,
  })
  assert.equal(result.verdict, "FAIL")
  assert.match(result.reasons.join(" "), /silently lost record/)
}

function testScaleAssessmentVerdicts() {
  const verdicts = assessMultiLeadIntakeScaleReadiness({
    measuredBatchSize: 25,
    measuredProviderPreviewCount: 25,
    datamoonRunDurationMinutes: 20,
    schedulerCadenceMinutes: 20,
  })
  const byTarget = new Map(verdicts.map((entry) => [entry.target, entry.verdict]))
  assert.equal(byTarget.get(100), "ready_with_limits")
  assert.equal(byTarget.get(1000), "not_ready")
  assert.equal(byTarget.get(10000), "not_ready")
}

async function testReportAssemblyInvariantsWithoutProductionAccess() {
  const mockAdmin = {} as SupabaseClient
  const validationStartedAt = "2026-07-19T12:00:00.000Z"
  const validationCompletedAt = "2026-07-19T12:05:00.000Z"
  const preflight = samplePreflight()

  const report = await assembleMultiLeadIntakeValidationReport(mockAdmin, {
    organizationId: preflight.organizationId,
    idempotencyKey: preflight.idempotencyKey,
    validationStartedAt,
    validationCompletedAt,
    focusRunId: null,
    preflight,
    idempotentRerun: {
      ran: true,
      newLeadsCreated: 0,
      duplicateLeadsCreated: 0,
      pass: true,
    },
    outboundMessagesInWindow: 0,
  })

  assert.equal(report.qaMarker, GROWTH_AIOS_MULTI_LEAD_INTAKE_1A_QA_MARKER)
  assert.equal(report.noDuplicateRuntimeAuthority, true)
  assert.equal(report.outboundConfirmedDisabled, true)
  assert.equal(report.outboundMessagesInWindow, 0)
  assert.equal(report.focusRunId, null)
  assert.equal(report.perCompany.length, 0)
  assert.equal(report.counts.providerCandidates, report.batchAccounting.providerRecordsReturned)
  assert.equal(report.counts.admitted, report.batchAccounting.admitted)
  assert.equal(report.counts.review, report.batchAccounting.review)
  assert.equal(report.counts.rejected, report.batchAccounting.rejected)
  assert.equal(report.counts.duplicates, report.batchAccounting.duplicates)
  assert.equal(report.counts.failures, report.batchAccounting.failed)
  assert.equal(report.counts.silentlyLost, report.batchAccounting.unexplained)
  assert.equal(report.scaleVerdicts.length, 3)
  assert.equal(report.executiveVerdict, "PASS WITH LIMITATIONS")
  assert.match(
    report.recommendedNextAction,
    /Accept bounded batch intake with noted limits/i,
  )
}

async function testReportAssemblyOutboundEnabledFailsExecutiveVerdict() {
  const mockAdmin = {} as SupabaseClient
  const report = await assembleMultiLeadIntakeValidationReport(mockAdmin, {
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    idempotencyKey: "outbound-enabled-test",
    validationStartedAt: "2026-07-19T12:00:00.000Z",
    validationCompletedAt: "2026-07-19T12:05:00.000Z",
    focusRunId: null,
    preflight: samplePreflight({ outboundKillSwitchEnabled: true }),
    idempotentRerun: {
      ran: false,
      newLeadsCreated: 0,
      duplicateLeadsCreated: 0,
      pass: true,
    },
    outboundMessagesInWindow: 0,
  })

  assert.equal(report.outboundConfirmedDisabled, false)
  assert.equal(report.executiveVerdict, "FAIL")
  assert.match(report.verdictReasons.join(" "), /Outbound kill switch was not disabled/)
}

async function testReportAssemblyIdempotentRerunFailureSurfacesInVerdict() {
  const mockAdmin = {} as SupabaseClient
  const report = await assembleMultiLeadIntakeValidationReport(mockAdmin, {
    organizationId: "00757488-1026-44a5-aac4-269533ac21be",
    idempotencyKey: "idempotent-fail-test",
    validationStartedAt: "2026-07-19T12:00:00.000Z",
    validationCompletedAt: "2026-07-19T12:05:00.000Z",
    focusRunId: null,
    preflight: samplePreflight(),
    idempotentRerun: {
      ran: true,
      newLeadsCreated: 2,
      duplicateLeadsCreated: 2,
      pass: false,
    },
    outboundMessagesInWindow: 0,
  })

  assert.equal(report.idempotentRerun.pass, false)
  assert.equal(report.executiveVerdict, "FAIL")
  assert.match(report.verdictReasons.join(" "), /Idempotent rerun created duplicate leads/)
}

async function main() {
  console.log(`[${GROWTH_AIOS_MULTI_LEAD_INTAKE_1A_QA_MARKER}] certification\n`)

  testBatchAccountingBalances()
  console.log("  ✓ batch accounting balances")

  testDuplicateRejectedReviewAdmittedFailedAccounting()
  console.log("  ✓ duplicate / rejected / review / admitted / failed accounting")

  testSilentlyLostRecordsBreakBalance()
  console.log("  ✓ silently lost or unexplained records")

  testExecutivePassRequiresAllCriteria()
  console.log("  ✓ executive PASS verdict logic")

  testExecutivePassWithLimitationsBelowThreeAdmitted()
  console.log("  ✓ executive PASS WITH LIMITATIONS verdict logic")

  testExecutiveFailWhenOutboundNotDisabled()
  console.log("  ✓ outbound-disabled confirmation logic")

  testExecutiveFailWhenIdempotentRerunCreatesDuplicates()
  console.log("  ✓ idempotent rerun interpretation")

  testExecutiveFailWhenSilentlyLostRecords()
  console.log("  ✓ executive FAIL on silently lost records")

  testScaleAssessmentVerdicts()
  console.log("  ✓ scale readiness verdicts")

  await testReportAssemblyInvariantsWithoutProductionAccess()
  console.log("  ✓ report assembly invariants (no production access)")

  await testReportAssemblyOutboundEnabledFailsExecutiveVerdict()
  console.log("  ✓ report assembly outbound-disabled gate")

  await testReportAssemblyIdempotentRerunFailureSurfacesInVerdict()
  console.log("  ✓ report assembly idempotent rerun gate")

  console.log(`\nPASS ${GROWTH_AIOS_MULTI_LEAD_INTAKE_1A_QA_MARKER}`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
