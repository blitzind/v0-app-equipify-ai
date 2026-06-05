/** Phase 7.PS-IJ — Future phase benchmark integration hooks. Client-safe. */

import {
  hasApolloReplacementBenchmarkDensityImprovement,
  summarizeApolloReplacementBenchmarkDeltas,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-delta"
import type {
  ApolloReplacementBenchmarkDeltaReport,
  ApolloReplacementBenchmarkMetrics,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

export type ApolloReplacementBenchmarkPhaseEvaluation = {
  density_claim_allowed: boolean
  improved: boolean
  regressions: string[]
  improvements: string[]
  delta_summary: string[]
}

export function evaluateApolloReplacementBenchmarkPhaseOutcome(input: {
  phase_name: string
  before: ApolloReplacementBenchmarkMetrics
  after: ApolloReplacementBenchmarkMetrics
  delta_report?: ApolloReplacementBenchmarkDeltaReport | null
}): ApolloReplacementBenchmarkPhaseEvaluation {
  const improvements: string[] = []
  const regressions: string[] = []

  if (input.after.person.named_persons > input.before.person.named_persons) {
    improvements.push("named_persons")
  } else if (input.after.person.named_persons < input.before.person.named_persons) {
    regressions.push("named_persons")
  }

  if (input.after.person.titled_persons > input.before.person.titled_persons) {
    improvements.push("titled_persons")
  } else if (input.after.person.titled_persons < input.before.person.titled_persons) {
    regressions.push("titled_persons")
  }

  if (input.after.channel.verified_emails > input.before.channel.verified_emails) {
    improvements.push("verified_emails")
  } else if (input.after.channel.verified_emails < input.before.channel.verified_emails) {
    regressions.push("verified_emails")
  }

  if (input.after.channel.verified_phones > input.before.channel.verified_phones) {
    improvements.push("verified_phones")
  } else if (input.after.channel.verified_phones < input.before.channel.verified_phones) {
    regressions.push("verified_phones")
  }

  if (input.after.company.outreach_ready_companies > input.before.company.outreach_ready_companies) {
    improvements.push("outreach_ready_companies")
  } else if (
    input.after.company.outreach_ready_companies < input.before.company.outreach_ready_companies
  ) {
    regressions.push("outreach_ready_companies")
  }

  if (input.after.quality.named_person_density > input.before.quality.named_person_density) {
    improvements.push("named_person_density")
  } else if (
    input.after.quality.named_person_density < input.before.quality.named_person_density
  ) {
    regressions.push("named_person_density")
  }

  const improved = hasApolloReplacementBenchmarkDensityImprovement(input.before, input.after)
  const density_claim_allowed = improved && regressions.length === 0

  return {
    density_claim_allowed,
    improved,
    regressions,
    improvements,
    delta_summary: input.delta_report
      ? summarizeApolloReplacementBenchmarkDeltas(input.delta_report)
      : [],
  }
}

/** Future phases should call this before claiming density improvement. */
export function assertApolloReplacementBenchmarkDensityClaim(input: {
  phase_name: string
  evaluation: ApolloReplacementBenchmarkPhaseEvaluation
}): { allowed: boolean; reason: string | null } {
  if (input.evaluation.density_claim_allowed) {
    return { allowed: true, reason: null }
  }
  if (input.evaluation.regressions.length > 0) {
    return {
      allowed: false,
      reason: `${input.phase_name}: benchmark regressions detected (${input.evaluation.regressions.join(", ")})`,
    }
  }
  return {
    allowed: false,
    reason: `${input.phase_name}: benchmark metrics did not improve — density claim blocked`,
  }
}
