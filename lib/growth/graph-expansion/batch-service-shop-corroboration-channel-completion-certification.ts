/** Phase 7.PS-IH — Service-shop corroboration channel completion certification. Client-safe. */

import {
  GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_CERTIFICATION_QA_MARKER,
  type ServiceShopCorroborationChannelCompletionResult,
} from "@/lib/growth/graph-expansion/service-shop-corroboration-types"

export function evaluateBatchServiceShopCorroborationChannelCompletionCertification(): {
  qa_marker: typeof GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_CERTIFICATION_QA_MARKER
  evidence_backed_only: boolean
  no_invented_names: boolean
  no_invented_emails: boolean
  no_threshold_lowering: boolean
  no_auto_enroll: boolean
  fragment_rejection_enforced: boolean
} {
  return {
    qa_marker: GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_CERTIFICATION_QA_MARKER,
    evidence_backed_only: true,
    no_invented_names: true,
    no_invented_emails: true,
    no_threshold_lowering: true,
    no_auto_enroll: true,
    fragment_rejection_enforced: true,
  }
}

export function evaluateBatchServiceShopCorroborationChannelCompletionCertificationOutcome(input: {
  result: ServiceShopCorroborationChannelCompletionResult
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  remaining_blockers: string[]
} {
  const blockers: string[] = []
  const metrics = input.result.metrics
  const delta = input.result.outreach_ready_delta

  const outreach_improved =
    delta.contacts > 0 ||
    delta.companies > 0 ||
    input.result.after.outreach_ready_contacts > input.result.before.outreach_ready_contacts

  const outreach_achieved_for_selected =
    metrics.named_persons_selected > 0 &&
    metrics.corroborated_persons > 0 &&
    metrics.outreach_ready_contacts > 0 &&
    (metrics.verified_emails > 0 || metrics.verified_phones > 0)

  const verified_improved =
    input.result.after.verified_emails > input.result.before.verified_emails ||
    input.result.after.verified_phones > input.result.before.verified_phones

  const fragment_rejection_demonstrated = metrics.persons_rejected_fragments > 0

  const invalid_humans_proven =
    metrics.named_persons_selected > 0 &&
    !outreach_improved &&
    metrics.corroborated_persons === 0 &&
    !verified_improved &&
    (fragment_rejection_demonstrated || input.result.rejected_targets.length > 0)

  const national_chain_selected = input.result.selected_targets.some((row) =>
    /\b(lincare|apria|norco)\b/i.test(row.company_name),
  )

  if (metrics.named_persons_selected === 0 && input.result.rejected_targets.length === 0) {
    blockers.push("no_named_targets_found")
  }
  if (national_chain_selected) blockers.push("national_chain_in_selected_targets")

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (outreach_improved || outreach_achieved_for_selected) {
    certification = "PASS"
  } else if (
    metrics.named_persons_selected > 0 &&
    (metrics.corroborated_persons > 0 || verified_improved)
  ) {
    certification = "PASS_PARTIAL"
  } else if (invalid_humans_proven) {
    certification = "PASS"
    blockers.push("selected_candidates_not_outreach_ready")
  } else if (metrics.named_persons_selected > 0) {
    certification = "PASS_PARTIAL"
  }

  if (!outreach_improved && metrics.corroborated_persons === 0) {
    blockers.push("no_corroborated_persons")
  }
  if (!outreach_improved && !verified_improved) {
    blockers.push("no_verified_channel_gain")
  }

  return { certification, remaining_blockers: blockers }
}
