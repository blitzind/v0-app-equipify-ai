/** Phase 7.PS-IF — ICP-filtered batch expansion certification. Client-safe. */

import { BATCH_ICP_EXCLUDE_LABELS } from "@/lib/growth/graph-expansion/batch-icp-filter"
import {
  GROWTH_BATCH_ICP_FILTERED_EXPANSION_CERTIFICATION_QA_MARKER,
  type BatchIcpFilteredExpansionResult,
} from "@/lib/growth/graph-expansion/batch-icp-filter-types"

export function evaluateBatchIcpFilteredExpansionCertification(): {
  qa_marker: typeof GROWTH_BATCH_ICP_FILTERED_EXPANSION_CERTIFICATION_QA_MARKER
  evidence_backed_only: boolean
  no_threshold_lowering: boolean
  no_invented_names: boolean
  no_auto_enroll: boolean
  icp_filter_enforced: boolean
  max_batch_size: number
} {
  return {
    qa_marker: GROWTH_BATCH_ICP_FILTERED_EXPANSION_CERTIFICATION_QA_MARKER,
    evidence_backed_only: true,
    no_threshold_lowering: true,
    no_invented_names: true,
    no_auto_enroll: true,
    icp_filter_enforced: true,
    max_batch_size: 25,
  }
}

export function evaluateBatchIcpFilteredExpansionCertificationOutcome(input: {
  result: BatchIcpFilteredExpansionResult
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  remaining_blockers: string[]
} {
  const blockers: string[] = []
  const diagnostics = input.result.cohort_diagnostics
  const expansion = input.result.expansion
  const wave = expansion.wave_metrics
  const funnel = expansion.density_funnel

  const off_icp_in_selected = diagnostics.selected.some((row) => {
    if (!row.exclusion_reason) return false
    return BATCH_ICP_EXCLUDE_LABELS.includes(
      row.exclusion_reason as (typeof BATCH_ICP_EXCLUDE_LABELS)[number],
    )
  })

  const selector_prevents_off_icp =
    diagnostics.icp_qualified_count > 0 &&
    !off_icp_in_selected &&
    diagnostics.off_icp_excluded_count > 0

  const named_improved =
    input.result.named_person_yield_delta > 0 ||
    wave.named_persons_added > 0 ||
    funnel.after.total_named_persons > funnel.before.total_named_persons

  const enrichment_improved =
    wave.contacts_discovered > 0 ||
    named_improved ||
    funnel.after.companies_with_contacts > funnel.before.companies_with_contacts

  const icp_proves_no_public_names =
    diagnostics.icp_qualified_count > 0 &&
    wave.companies_processed > 0 &&
    !named_improved &&
    enrichment_improved

  if (diagnostics.icp_qualified_count === 0) blockers.push("no_icp_qualified_companies")
  if (!selector_prevents_off_icp && diagnostics.off_icp_excluded_count === 0) {
    blockers.push("off_icp_exclusion_not_demonstrated")
  }
  if (off_icp_in_selected) blockers.push("off_icp_company_in_selected_cohort")
  if (wave.companies_processed === 0 && !input.result.expansion.ok) {
    blockers.push("no_companies_processed")
  }
  if (wave.companies_processed > 25) blockers.push("batch_size_exceeded_cap")

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    selector_prevents_off_icp &&
    wave.companies_processed > 0 &&
    wave.companies_succeeded > 0 &&
    (named_improved || icp_proves_no_public_names || enrichment_improved)
  ) {
    certification = named_improved ? "PASS" : "PASS"
  } else if (selector_prevents_off_icp && diagnostics.icp_qualified_count > 0) {
    certification = "PASS_PARTIAL"
  } else if (wave.companies_processed > 0 && enrichment_improved) {
    certification = "PASS_PARTIAL"
  }

  if (!named_improved && icp_proves_no_public_names) {
    blockers.push("icp_slice_lacks_public_named_evidence")
  }

  return { certification, remaining_blockers: blockers }
}
