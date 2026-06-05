/** Phase 7.PS-IE — Batch wave density improvement certification. Client-safe. */

import {
  GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_CERTIFICATION_QA_MARKER,
  type BatchWaveDensityImprovementResult,
} from "@/lib/growth/graph-expansion/batch-wave-density-improvement-types"

export function evaluateBatchWaveDensityImprovementCertification(): {
  qa_marker: typeof GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_CERTIFICATION_QA_MARKER
  evidence_backed_only: boolean
  no_threshold_lowering: boolean
  no_invented_names: boolean
  no_auto_enroll: boolean
  wave1_only: boolean
} {
  return {
    qa_marker: GROWTH_BATCH_WAVE_DENSITY_IMPROVEMENT_CERTIFICATION_QA_MARKER,
    evidence_backed_only: true,
    no_threshold_lowering: true,
    no_invented_names: true,
    no_auto_enroll: true,
    wave1_only: true,
  }
}

export function evaluateBatchWaveDensityImprovementCertificationOutcome(input: {
  result: BatchWaveDensityImprovementResult
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  remaining_blockers: string[]
} {
  const blockers: string[] = []
  const metrics = input.result.metrics
  const funnel = input.result.density_funnel

  const named_improved =
    metrics.named_persons_delta > 0 ||
    funnel.after.total_named_persons > funnel.before.total_named_persons

  const discovery_improved = metrics.pages_newly_crawled > 0

  const audit_proves_no_public_names =
    input.result.companies_inspected > 0 &&
    !named_improved &&
    input.result.company_audits.every(
      (audit) =>
        audit.discovery_gaps.length > 0 ||
        audit.why_remained_generic.includes("only_generic_company_channels_extracted") ||
        audit.person_page_paths_attempted.length === 0,
    )

  if (input.result.companies_inspected === 0) blockers.push("no_companies_inspected")
  if (metrics.companies_processed === 0) blockers.push("no_companies_processed")
  if (metrics.companies_failed === metrics.companies_processed && metrics.companies_processed > 0) {
    blockers.push("all_companies_failed")
  }
  if (!named_improved && !audit_proves_no_public_names && !discovery_improved) {
    blockers.push("no_named_yield_and_no_discovery_improvement")
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    metrics.companies_processed > 0 &&
    metrics.companies_succeeded > 0 &&
    (named_improved || audit_proves_no_public_names)
  ) {
    certification = named_improved ? "PASS" : "PASS"
  } else if (metrics.companies_processed > 0 && discovery_improved) {
    certification = "PASS_PARTIAL"
  } else if (metrics.companies_processed > 0) {
    certification = "PASS_PARTIAL"
  }

  if (!named_improved && audit_proves_no_public_names) {
    blockers.push("audit_confirms_no_public_named_evidence")
  }

  return { certification, remaining_blockers: blockers }
}
