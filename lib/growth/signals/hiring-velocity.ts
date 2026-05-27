import { GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY } from "@/lib/growth/signals/signal-dedupe"
import {
  classifyHiringIntensity,
  type GrowthHiringIntensity,
} from "@/lib/growth/signals/job-signal-classification"
import type { GrowthNormalizedSignalDraft, GrowthSignalRow } from "@/lib/growth/signals/signal-types"

export type HiringVelocityMetrics = {
  open_role_count: number
  hiring_velocity_7d: number
  hiring_velocity_30d: number
  hiring_spike: boolean
  hiring_intensity: GrowthHiringIntensity
  department_distribution: Record<string, number>
  geographies: string[]
}

export { GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY } from "@/lib/growth/signals/signal-dedupe"

export type DerivedHiringAggregate = {
  company_key: string
  company_name: string
  domain: string | null
  organization_id: string | null
  metrics: HiringVelocityMetrics
  job_postings: GrowthSignalRow[]
  latest_occurred_at: string
  primary_source_url: string | null
  primary_publisher: string | null
}

const MS_7D = 7 * 24 * 60 * 60 * 1000
const MS_30D = 30 * 24 * 60 * 60 * 1000

function normalizeCompanyKey(domain: string | null | undefined, companyName: string | null | undefined): string {
  const domainKey = domain?.trim().toLowerCase()
  if (domainKey) return `domain:${domainKey}`
  const nameKey = companyName?.trim().toLowerCase()
  if (nameKey) return `company:${nameKey}`
  return "unknown"
}

function parseOccurredAtMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : 0
}

function readPublisher(signal: GrowthSignalRow): string | null {
  const publisher = signal.metadata?.publisher
  return typeof publisher === "string" && publisher.trim() ? publisher.trim() : null
}

function readEvidenceUrlFromJobPosting(signal: GrowthSignalRow): string | null {
  const fromMeta = signal.metadata?.source_url
  if (typeof fromMeta === "string" && fromMeta.startsWith("http")) return fromMeta
  return null
}

export function computeHiringVelocityMetrics(
  jobPostings: GrowthSignalRow[],
  nowMs = Date.now(),
): HiringVelocityMetrics {
  const cutoff7d = nowMs - MS_7D
  const cutoff30d = nowMs - MS_30D

  const recent7d = jobPostings.filter((row) => parseOccurredAtMs(row.occurred_at) >= cutoff7d)
  const recent30d = jobPostings.filter((row) => parseOccurredAtMs(row.occurred_at) >= cutoff30d)

  const department_distribution: Record<string, number> = {}
  const geographies = new Set<string>()

  for (const row of jobPostings) {
    const dept = row.category?.trim() || "Unknown"
    department_distribution[dept] = (department_distribution[dept] ?? 0) + 1
    if (row.geography?.trim()) geographies.add(row.geography.trim())
  }

  const open_role_count = jobPostings.length
  const hiring_velocity_7d = recent7d.length
  const hiring_velocity_30d = recent30d.length
  const baselineWeekly = hiring_velocity_30d > 0 ? hiring_velocity_30d / 4 : 0
  const hiring_spike = hiring_velocity_7d >= 3 && (baselineWeekly === 0 || hiring_velocity_7d >= baselineWeekly * 2)

  return {
    open_role_count,
    hiring_velocity_7d,
    hiring_velocity_30d,
    hiring_spike,
    hiring_intensity: classifyHiringIntensity(open_role_count),
    department_distribution,
    geographies: [...geographies],
  }
}

export function aggregateJobPostingsToHiringVelocity(
  jobPostings: GrowthSignalRow[],
  nowMs = Date.now(),
): DerivedHiringAggregate[] {
  const groups = new Map<string, GrowthSignalRow[]>()

  for (const row of jobPostings) {
    if (row.signal_type !== "job_posting") continue
    const key = normalizeCompanyKey(row.domain, row.company_name)
    const existing = groups.get(key) ?? []
    existing.push(row)
    groups.set(key, existing)
  }

  const aggregates: DerivedHiringAggregate[] = []

  for (const [company_key, postings] of groups) {
    if (postings.length === 0) continue

    const sorted = [...postings].sort(
      (a, b) => parseOccurredAtMs(b.occurred_at) - parseOccurredAtMs(a.occurred_at),
    )
    const primary = sorted[0]!
    const metrics = computeHiringVelocityMetrics(postings, nowMs)
    const primarySourceUrl = sorted.map(readEvidenceUrlFromJobPosting).find(Boolean) ?? null

    aggregates.push({
      company_key,
      company_name: primary.company_name?.trim() || primary.domain?.trim() || "—",
      domain: primary.domain,
      organization_id: primary.organization_id,
      metrics,
      job_postings: sorted,
      latest_occurred_at: primary.occurred_at,
      primary_source_url: primarySourceUrl,
      primary_publisher: readPublisher(primary),
    })
  }

  return aggregates.sort((a, b) => b.metrics.open_role_count - a.metrics.open_role_count)
}

export function formatDepartmentDistribution(
  distribution: Record<string, number>,
  limit = 3,
): string {
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return "—"
  return entries
    .slice(0, limit)
    .map(([dept, count]) => `${dept} (${count})`)
    .join(", ")
}

export function buildDerivedHireSignalDraft(aggregate: DerivedHiringAggregate): GrowthNormalizedSignalDraft {
  const { metrics, company_name, domain, organization_id, latest_occurred_at, job_postings } = aggregate
  const departments = Object.keys(metrics.department_distribution).filter((d) => d !== "Unknown")
  const deptSummary = formatDepartmentDistribution(metrics.department_distribution)
  const geography =
    metrics.geographies.length === 1
      ? metrics.geographies[0]!
      : metrics.geographies.length > 1
        ? `${metrics.geographies.length} locations`
        : null

  const primaryJob = job_postings[0]
  const resolvedUrl = aggregate.primary_source_url ?? (primaryJob ? readEvidenceUrlFromJobPosting(primaryJob) : null)

  const excerpt = [
    `${metrics.open_role_count} open role${metrics.open_role_count === 1 ? "" : "s"}`,
    `7d velocity: ${metrics.hiring_velocity_7d}`,
    `30d velocity: ${metrics.hiring_velocity_30d}`,
    metrics.hiring_spike ? "hiring spike detected" : null,
    deptSummary !== "—" ? `departments: ${deptSummary}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const title = `Active hiring: ${metrics.open_role_count} open role${metrics.open_role_count === 1 ? "" : "s"}`

  return {
    signal_type: "hire",
    provider_key: GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY,
    provider_event_id: aggregate.company_key,
    organization_id,
    occurred_at: latest_occurred_at,
    company_name,
    domain,
    geography,
    category: departments[0] ?? "Unknown",
    title,
    evidence: [
      {
        source_type: "job_posting",
        source_label: aggregate.primary_publisher ?? "hiring_velocity_derived",
        source_url: resolvedUrl,
        publisher: aggregate.primary_publisher,
        excerpt,
        observed_at: latest_occurred_at,
      },
    ],
    metadata: {
      derived_from: "job_posting",
      derived_provider: GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY,
      hiring_velocity: metrics,
      department_distribution: metrics.department_distribution,
      job_posting_signal_ids: job_postings.map((row) => row.id),
      company_linkage: {
        company_name: company_name || null,
        domain: domain ?? null,
      },
      aggregate_only: true,
      no_employee_records: true,
    },
  }
}

/** Example derived hire output shape for operator docs / tests. */
export const GROWTH_DERIVED_HIRE_SIGNAL_EXAMPLE = {
  signal_type: "hire",
  provider_key: GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY,
  company_name: "Acme Health Systems",
  domain: "acmehealth.com",
  title: "Active hiring: 4 open roles",
  metadata: {
    derived_from: "job_posting",
    aggregate_only: true,
    no_employee_records: true,
    hiring_velocity: {
      open_role_count: 4,
      hiring_velocity_7d: 2,
      hiring_velocity_30d: 4,
      hiring_spike: false,
      hiring_intensity: "medium",
      department_distribution: {
        "Field Service": 2,
        Biomedical: 1,
        Dispatch: 1,
      },
    },
  },
} as const
