/** Phase 7.PS-IJ — Apollo replacement benchmark delta reporting. Client-safe. */

import type {
  ApolloReplacementBenchmarkDeltaReport,
  ApolloReplacementBenchmarkMetricDelta,
  ApolloReplacementBenchmarkMetrics,
  ApolloReplacementBenchmarkSnapshotRecord,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

export function computeApolloReplacementBenchmarkMetricDelta(
  before: number,
  after: number,
): ApolloReplacementBenchmarkMetricDelta {
  const absolute = after - before
  const percent =
    before === 0 ? (after > 0 ? 100 : 0) : Math.round((absolute / before) * 100)
  return { before, after, absolute, percent }
}

export function buildApolloReplacementBenchmarkDeltaReport(input: {
  before_snapshot: ApolloReplacementBenchmarkSnapshotRecord
  after_snapshot: ApolloReplacementBenchmarkSnapshotRecord
}): ApolloReplacementBenchmarkDeltaReport {
  const before = input.before_snapshot.metrics
  const after = input.after_snapshot.metrics

  return {
    benchmark_id: input.after_snapshot.benchmark_id,
    before_snapshot: input.before_snapshot,
    after_snapshot: input.after_snapshot,
    deltas: {
      named_persons: computeApolloReplacementBenchmarkMetricDelta(
        before.person.named_persons,
        after.person.named_persons,
      ),
      titled_persons: computeApolloReplacementBenchmarkMetricDelta(
        before.person.titled_persons,
        after.person.titled_persons,
      ),
      verified_emails: computeApolloReplacementBenchmarkMetricDelta(
        before.channel.verified_emails,
        after.channel.verified_emails,
      ),
      verified_phones: computeApolloReplacementBenchmarkMetricDelta(
        before.channel.verified_phones,
        after.channel.verified_phones,
      ),
      committee_members: computeApolloReplacementBenchmarkMetricDelta(
        before.person.committee_members,
        after.person.committee_members,
      ),
      outreach_ready_companies: computeApolloReplacementBenchmarkMetricDelta(
        before.company.outreach_ready_companies,
        after.company.outreach_ready_companies,
      ),
      sequence_ready_companies: computeApolloReplacementBenchmarkMetricDelta(
        before.company.sequence_ready_companies,
        after.company.sequence_ready_companies,
      ),
    },
  }
}

export function formatApolloReplacementBenchmarkDeltaLine(
  label: string,
  delta: ApolloReplacementBenchmarkMetricDelta,
): string {
  const sign = delta.absolute >= 0 ? "+" : ""
  const pct =
    delta.percent === null ? "n/a" : `${delta.percent >= 0 ? "+" : ""}${delta.percent}%`
  return `${label}: ${delta.before} → ${delta.after} (${sign}${delta.absolute}, ${pct})`
}

export function summarizeApolloReplacementBenchmarkDeltas(
  report: ApolloReplacementBenchmarkDeltaReport,
): string[] {
  return [
    formatApolloReplacementBenchmarkDeltaLine("Named Persons", report.deltas.named_persons),
    formatApolloReplacementBenchmarkDeltaLine("Titled Persons", report.deltas.titled_persons),
    formatApolloReplacementBenchmarkDeltaLine("Verified Emails", report.deltas.verified_emails),
    formatApolloReplacementBenchmarkDeltaLine("Verified Phones", report.deltas.verified_phones),
    formatApolloReplacementBenchmarkDeltaLine("Committee Members", report.deltas.committee_members),
    formatApolloReplacementBenchmarkDeltaLine(
      "Outreach Ready",
      report.deltas.outreach_ready_companies,
    ),
    formatApolloReplacementBenchmarkDeltaLine(
      "Sequence Ready",
      report.deltas.sequence_ready_companies,
    ),
  ]
}

export function hasApolloReplacementBenchmarkDensityImprovement(
  before: ApolloReplacementBenchmarkMetrics,
  after: ApolloReplacementBenchmarkMetrics,
): boolean {
  return (
    after.person.named_persons > before.person.named_persons ||
    after.person.titled_persons > before.person.titled_persons ||
    after.channel.verified_emails > before.channel.verified_emails ||
    after.channel.verified_phones > before.channel.verified_phones ||
    after.company.outreach_ready_companies > before.company.outreach_ready_companies ||
    after.quality.named_person_density > before.quality.named_person_density ||
    after.quality.outreach_ready_density > before.quality.outreach_ready_density
  )
}
