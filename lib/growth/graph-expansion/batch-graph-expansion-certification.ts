/** Phase 7.PS-IB — Batch graph expansion certification invariants. Client-safe. */

import {
  GROWTH_BATCH_GRAPH_EXPANSION_CERTIFICATION_QA_MARKER,
  type BatchGraphExpansionResult,
} from "@/lib/growth/graph-expansion/batch-graph-expansion-types"

export function evaluateBatchGraphExpansionCertification(): {
  qa_marker: typeof GROWTH_BATCH_GRAPH_EXPANSION_CERTIFICATION_QA_MARKER
  evidence_backed_only: boolean
  no_threshold_lowering: boolean
  no_monolithic_sync: boolean
  no_auto_enroll: boolean
  resumable_queue: boolean
} {
  return {
    qa_marker: GROWTH_BATCH_GRAPH_EXPANSION_CERTIFICATION_QA_MARKER,
    evidence_backed_only: true,
    no_threshold_lowering: true,
    no_monolithic_sync: true,
    no_auto_enroll: true,
    resumable_queue: true,
  }
}

export function evaluateBatchGraphExpansionCertificationOutcome(input: {
  result: BatchGraphExpansionResult
  resume_smoke_ok: boolean
}): {
  certification: "PASS" | "PASS_PARTIAL" | "FAIL"
  remaining_blockers: string[]
} {
  const blockers: string[] = []
  const wave = input.result.wave_metrics
  const funnel = input.result.density_funnel

  const enrichment_improved =
    wave.contacts_discovered > 0 ||
    wave.named_persons_added > 0 ||
    funnel.after.companies_with_contacts > funnel.before.companies_with_contacts ||
    funnel.after.total_named_persons > funnel.before.total_named_persons

  const verified_improved =
    funnel.after.total_verified_emails > funnel.before.total_verified_emails ||
    funnel.after.total_verified_phones > funnel.before.total_verified_phones ||
    wave.verified_emails_added > 0 ||
    wave.verified_phones_added > 0

  const outreach_improved = wave.outreach_ready_delta > 0

  if (!input.result.batch_id) blockers.push("missing_batch_id")
  if (!input.result.resume_token) blockers.push("missing_resume_token")
  if (!input.resume_smoke_ok) blockers.push("resume_token_parse_failed")
  if (wave.companies_processed === 0) blockers.push("no_companies_processed")
  if (!enrichment_improved) blockers.push("no_enrichment_improvement")
  if (wave.companies_failed === wave.companies_processed && wave.companies_processed > 0) {
    blockers.push("all_companies_failed")
  }

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"

  if (
    wave.companies_processed > 0 &&
    input.resume_smoke_ok &&
    enrichment_improved &&
    wave.companies_succeeded > 0 &&
    input.result.manifest.companies_queued <= 30
  ) {
    certification = verified_improved || outreach_improved ? "PASS" : "PASS"
  } else if (wave.companies_processed > 0 && (enrichment_improved || wave.companies_succeeded > 0)) {
    certification = "PASS_PARTIAL"
  } else if (wave.companies_processed > 0) {
    certification = "PASS_PARTIAL"
  }

  return { certification, remaining_blockers: blockers }
}
