/** Apollo intelligence recovery — per-company and aggregate write evidence (client-safe). */

import type {
  ApolloIntelligenceRecoveryCompanyEvidence,
  ApolloIntelligenceRecoveryIntelligenceOutcome,
  ApolloIntelligenceRecoveryMode,
  ApolloIntelligenceRecoveryWriteEvidence,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-types"

export function classifyApolloIntelligenceRecoveryNoOpReason(input: {
  canonical_resolved: boolean
  sequence_ready: boolean
  score_before: number
  score_after: number
  company_intelligence_attempted: boolean
  company_intelligence_outcome: ApolloIntelligenceRecoveryIntelligenceOutcome
  buying_committee_attempted: boolean
  buying_committee_outcome: ApolloIntelligenceRecoveryIntelligenceOutcome
  intelligence_added: string[]
  errors: string[]
}): string {
  if (!input.sequence_ready && input.score_before === 0) {
    return "score_zero_not_sequence_ready"
  }
  if (!input.canonical_resolved) {
    return "canonical_unresolved"
  }
  if (input.company_intelligence_attempted && input.company_intelligence_outcome === "failed") {
    return "company_intelligence_write_failed"
  }
  if (input.buying_committee_attempted && input.buying_committee_outcome === "failed") {
    return "buying_committee_write_failed"
  }
  if (
    input.buying_committee_attempted &&
    input.buying_committee_outcome === "created" &&
    input.score_after === input.score_before
  ) {
    return "buying_committee_written_scorer_not_consuming"
  }
  if (
    input.company_intelligence_attempted &&
    input.company_intelligence_outcome === "created" &&
    input.score_after === input.score_before &&
    input.intelligence_added.length > 0
  ) {
    return "company_intelligence_written_scorer_not_consuming"
  }
  if (
    input.company_intelligence_outcome === "reused" &&
    input.buying_committee_outcome === "skipped" &&
    input.score_after < 70
  ) {
    return "company_intelligence_already_present_buying_committee_missing"
  }
  if (input.errors.length > 0) {
    return "recovery_errors_present"
  }
  if (input.score_after === input.score_before) {
    return "no_score_change"
  }
  return "unknown_no_op"
}

export function buildApolloIntelligenceRecoveryCompanyEvidence(input: {
  company_candidate_id: string
  company_name: string
  canonical_company_id_before: string | null
  canonical_company_id_after: string | null
  canonical_resolution_attempted: boolean
  canonical_resolution_result: "resolved" | "unresolved" | "not_attempted"
  canonical_resolution_blocker: string | null
  company_intelligence_before: boolean
  company_intelligence_after: boolean
  company_intelligence_attempted: boolean
  company_intelligence_outcome: ApolloIntelligenceRecoveryIntelligenceOutcome
  company_intelligence_error: string | null
  buying_committee_before: boolean
  buying_committee_after: boolean
  buying_committee_attempted: boolean
  buying_committee_outcome: ApolloIntelligenceRecoveryIntelligenceOutcome
  buying_committee_error: string | null
  fit_score_before: number | null
  fit_score_after: number | null
  research_score_before: number | null
  research_score_after: number | null
  qualification_score_before: number
  qualification_score_after: number
  remaining_blockers: string[]
  production_threshold: number
}): ApolloIntelligenceRecoveryCompanyEvidence {
  const intelligence_added: string[] = []
  if (input.company_intelligence_after && !input.company_intelligence_before) {
    intelligence_added.push("company_intelligence")
  }
  if (input.buying_committee_after && !input.buying_committee_before) {
    intelligence_added.push("buying_committee")
  }
  if (input.fit_score_after != null && input.fit_score_before == null) {
    intelligence_added.push("fit_score")
  }
  if (input.research_score_after != null && input.research_score_before == null) {
    intelligence_added.push("research_score")
  }

  const errors = [
    input.company_intelligence_error,
    input.buying_committee_error,
  ].filter(Boolean) as string[]

  const no_op_reason = classifyApolloIntelligenceRecoveryNoOpReason({
    canonical_resolved: Boolean(input.canonical_company_id_after),
    sequence_ready: input.qualification_score_before > 0 || input.qualification_score_after > 0,
    score_before: input.qualification_score_before,
    score_after: input.qualification_score_after,
    company_intelligence_attempted: input.company_intelligence_attempted,
    company_intelligence_outcome: input.company_intelligence_outcome,
    buying_committee_attempted: input.buying_committee_attempted,
    buying_committee_outcome: input.buying_committee_outcome,
    intelligence_added,
    errors,
  })

  return {
    company_candidate_id: input.company_candidate_id,
    company_name: input.company_name,
    canonical_company_id_before: input.canonical_company_id_before,
    canonical_company_id_after: input.canonical_company_id_after,
    canonical_resolution_attempted: input.canonical_resolution_attempted,
    canonical_resolution_result: input.canonical_resolution_result,
    canonical_resolution_blocker: input.canonical_resolution_blocker,
    company_intelligence_before: input.company_intelligence_before,
    company_intelligence_after: input.company_intelligence_after,
    company_intelligence_attempted: input.company_intelligence_attempted,
    company_intelligence_created_or_reused:
      input.company_intelligence_outcome === "created" ||
      input.company_intelligence_outcome === "reused",
    company_intelligence_outcome: input.company_intelligence_outcome,
    company_intelligence_error: input.company_intelligence_error,
    buying_committee_before: input.buying_committee_before,
    buying_committee_after: input.buying_committee_after,
    buying_committee_attempted: input.buying_committee_attempted,
    buying_committee_created_or_reused:
      input.buying_committee_outcome === "created" || input.buying_committee_outcome === "reused",
    buying_committee_outcome: input.buying_committee_outcome,
    buying_committee_error: input.buying_committee_error,
    fit_score_before: input.fit_score_before,
    fit_score_after: input.fit_score_after,
    research_score_before: input.research_score_before,
    research_score_after: input.research_score_after,
    qualification_score_before: input.qualification_score_before,
    qualification_score_after: input.qualification_score_after,
    score_delta: input.qualification_score_after - input.qualification_score_before,
    crossed_threshold:
      input.qualification_score_before < input.production_threshold &&
      input.qualification_score_after >= input.production_threshold,
    remaining_blockers: input.remaining_blockers,
    intelligence_added,
    no_op_reason,
  }
}

export function aggregateApolloIntelligenceRecoveryWriteEvidence(
  rows: ApolloIntelligenceRecoveryCompanyEvidence[],
): ApolloIntelligenceRecoveryWriteEvidence {
  const no_op_reason_counts: Record<string, number> = {}

  let canonical_resolution_attempted_count = 0
  let canonical_resolved_count = 0
  let canonical_unresolved_count = 0
  let company_intelligence_attempted_count = 0
  let company_intelligence_created_count = 0
  let company_intelligence_reused_count = 0
  let company_intelligence_failed_count = 0
  let buying_committee_attempted_count = 0
  let buying_committee_created_count = 0
  let buying_committee_reused_count = 0
  let buying_committee_failed_count = 0
  let companies_with_score_increase = 0
  let companies_crossed_threshold = 0

  for (const row of rows) {
    if (row.canonical_resolution_attempted) canonical_resolution_attempted_count += 1
    if (row.canonical_company_id_after) canonical_resolved_count += 1
    if (row.canonical_resolution_attempted && !row.canonical_company_id_after) {
      canonical_unresolved_count += 1
    }

    if (row.company_intelligence_attempted) company_intelligence_attempted_count += 1
    if (row.company_intelligence_outcome === "created") company_intelligence_created_count += 1
    if (row.company_intelligence_outcome === "reused") company_intelligence_reused_count += 1
    if (row.company_intelligence_outcome === "failed") company_intelligence_failed_count += 1

    if (row.buying_committee_attempted) buying_committee_attempted_count += 1
    if (row.buying_committee_outcome === "created") buying_committee_created_count += 1
    if (row.buying_committee_outcome === "reused") buying_committee_reused_count += 1
    if (row.buying_committee_outcome === "failed") buying_committee_failed_count += 1

    if (row.score_delta > 0) companies_with_score_increase += 1
    if (row.crossed_threshold) companies_crossed_threshold += 1

    if (row.score_delta === 0) {
      no_op_reason_counts[row.no_op_reason] = (no_op_reason_counts[row.no_op_reason] ?? 0) + 1
    }
  }

  return {
    canonical_resolution_attempted_count,
    canonical_resolved_count,
    canonical_unresolved_count,
    company_intelligence_attempted_count,
    company_intelligence_created_count,
    company_intelligence_reused_count,
    company_intelligence_failed_count,
    buying_committee_attempted_count,
    buying_committee_created_count,
    buying_committee_reused_count,
    buying_committee_failed_count,
    companies_with_score_increase,
    companies_crossed_threshold,
    no_op_reason_counts,
  }
}

export function evaluateApolloIntelligenceRecoveryNoOp(input: {
  mode: ApolloIntelligenceRecoveryMode
  writes_performed: boolean
  write_evidence: ApolloIntelligenceRecoveryWriteEvidence
}): {
  recovery_ok: boolean
  severity: "ok" | "critical"
  no_op_root_cause: string | null
  top_no_op_reasons: string[]
} {
  const isRecover = input.mode === "recover_missing_intelligence"
  const noOp =
    isRecover &&
    (!input.writes_performed ||
      input.write_evidence.companies_with_score_increase === 0 &&
        input.write_evidence.companies_crossed_threshold === 0)

  if (!noOp) {
    return { recovery_ok: true, severity: "ok", no_op_root_cause: null, top_no_op_reasons: [] }
  }

  const sorted = Object.entries(input.write_evidence.no_op_reason_counts).sort(
    (left, right) => right[1] - left[1],
  )
  const top_no_op_reasons = sorted.slice(0, 5).map(([reason, count]) => `${reason} (${count})`)

  let no_op_root_cause: string
  if (!input.writes_performed) {
    no_op_root_cause = "writes_performed_false_in_recover_mode"
  } else if (input.write_evidence.canonical_unresolved_count > 0) {
    no_op_root_cause = `canonical_unresolved_for_${input.write_evidence.canonical_unresolved_count}_companies`
  } else if (input.write_evidence.buying_committee_failed_count > 0) {
    no_op_root_cause = "buying_committee_writes_failed"
  } else if (input.write_evidence.company_intelligence_failed_count > 0) {
    no_op_root_cause = "company_intelligence_writes_failed"
  } else if (
    input.write_evidence.buying_committee_created_count === 0 &&
    input.write_evidence.company_intelligence_created_count === 0
  ) {
    no_op_root_cause = "no_intelligence_artifacts_created_or_reused"
  } else {
    no_op_root_cause = "intelligence_written_but_scorer_did_not_increase"
  }

  return {
    recovery_ok: false,
    severity: "critical",
    no_op_root_cause,
    top_no_op_reasons,
  }
}
