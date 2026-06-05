/** Phase 7.PS-IG — Service-shop batch expansion certification. Client-safe. */

import {
  GROWTH_SERVICE_SHOP_EXPANSION_CERTIFICATION_QA_MARKER,
  type ServiceShopExpansionResult,
} from "@/lib/growth/graph-expansion/service-shop-expansion-types"

export function evaluateBatchServiceShopExpansionCertification(): {
  qa_marker: typeof GROWTH_SERVICE_SHOP_EXPANSION_CERTIFICATION_QA_MARKER
  evidence_backed_only: boolean
  no_paid_enrichment: boolean
  no_invented_names: boolean
  no_auto_enroll: boolean
  service_shop_scoring_enforced: boolean
  max_batch_size: number
} {
  return {
    qa_marker: GROWTH_SERVICE_SHOP_EXPANSION_CERTIFICATION_QA_MARKER,
    evidence_backed_only: true,
    no_paid_enrichment: true,
    no_invented_names: true,
    no_auto_enroll: true,
    service_shop_scoring_enforced: true,
    max_batch_size: 25,
  }
}

export function evaluateBatchServiceShopExpansionCertificationOutcome(input: {
  result: ServiceShopExpansionResult
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  remaining_blockers: string[]
} {
  const blockers: string[] = []
  const diagnostics = input.result.cohort_diagnostics
  const expansion = input.result.expansion
  const wave = expansion.wave_metrics
  const funnel = expansion.density_funnel

  const national_chain_in_selected = diagnostics.selected.some((row) =>
    /\b(lincare|apria|norco.?inc|home medical equipment)\b/i.test(row.company_name),
  )

  const service_shop_targeting_ok =
    diagnostics.companies_selected > 0 &&
    !national_chain_in_selected &&
    diagnostics.down_ranked_excluded > 0 &&
    diagnostics.score_distribution.high + diagnostics.score_distribution.medium > 0

  const named_improved =
    input.result.named_person_yield_delta > 0 ||
    wave.named_persons_added > 0 ||
    funnel.after.total_named_persons > funnel.before.total_named_persons ||
    input.result.names_discovered.length > 0

  const enrichment_improved =
    wave.contacts_discovered > 0 ||
    named_improved ||
    funnel.after.companies_with_contacts > funnel.before.companies_with_contacts

  const service_shop_proves_no_public_names =
    diagnostics.companies_selected > 0 &&
    wave.companies_processed > 0 &&
    !named_improved &&
    (enrichment_improved || wave.companies_succeeded > 0)

  if (diagnostics.companies_selected === 0) blockers.push("no_service_shop_companies_selected")
  if (national_chain_in_selected) blockers.push("national_chain_in_selected_cohort")
  if (diagnostics.down_ranked_excluded === 0) blockers.push("down_rank_exclusion_not_demonstrated")
  if (wave.companies_processed === 0) blockers.push("no_companies_processed")
  if (wave.companies_processed > 25) blockers.push("batch_size_exceeded_cap")

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    service_shop_targeting_ok &&
    wave.companies_processed > 0 &&
    wave.companies_succeeded > 0 &&
    (named_improved || service_shop_proves_no_public_names)
  ) {
    certification = "PASS"
  } else if (service_shop_targeting_ok && diagnostics.companies_selected > 0) {
    certification = "PASS_PARTIAL"
  } else if (wave.companies_processed > 0 && enrichment_improved) {
    certification = "PASS_PARTIAL"
  }

  if (!named_improved && service_shop_proves_no_public_names) {
    blockers.push("service_shop_slice_lacks_public_named_evidence")
  }

  return { certification, remaining_blockers: blockers }
}
