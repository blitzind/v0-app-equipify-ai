/** Background progressive enrichment queue — client-safe orchestration types. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { ProspectSearchEnrichmentTier } from "@/lib/growth/prospect-search/prospect-search-progressive-enrichment"

export const GROWTH_BACKGROUND_ENRICHMENT_QUEUE_QA_MARKER =
  "growth-background-enrichment-queue-v1" as const

export type ProspectSearchBackgroundEnrichmentTrigger =
  | "viewed"
  | "selected"
  | "queued"
  | "exported"
  | "sequence_candidate"
  | "saved_workflow"
  | "bulk_action"

export type ProspectSearchBackgroundEnrichmentJob = {
  id: string
  company_id: string
  source_type: string
  trigger: ProspectSearchBackgroundEnrichmentTrigger
  target_tier: ProspectSearchEnrichmentTier
  enqueued_at: string
  status: "pending" | "running" | "completed" | "failed"
  error_message?: string | null
}

export function prospectSearchBackgroundEnrichmentJobId(
  company: Pick<GrowthProspectSearchCompanyResult, "source_type" | "id">,
  trigger: ProspectSearchBackgroundEnrichmentTrigger,
): string {
  return `${company.source_type}:${company.id}:${trigger}`
}

export function enqueueProspectSearchBackgroundEnrichmentJobs(input: {
  companies: GrowthProspectSearchCompanyResult[]
  trigger: ProspectSearchBackgroundEnrichmentTrigger
  target_tier: ProspectSearchEnrichmentTier
  existing?: Map<string, ProspectSearchBackgroundEnrichmentJob>
}): {
  jobs: ProspectSearchBackgroundEnrichmentJob[]
  queue: Map<string, ProspectSearchBackgroundEnrichmentJob>
} {
  const queue = new Map(input.existing ?? [])
  const jobs: ProspectSearchBackgroundEnrichmentJob[] = []
  const now = new Date().toISOString()

  for (const company of input.companies) {
    const id = prospectSearchBackgroundEnrichmentJobId(company, input.trigger)
    if (queue.has(id)) continue
    const job: ProspectSearchBackgroundEnrichmentJob = {
      id,
      company_id: company.id,
      source_type: company.source_type,
      trigger: input.trigger,
      target_tier: input.target_tier,
      enqueued_at: now,
      status: "pending",
    }
    queue.set(id, job)
    jobs.push(job)
  }

  return { jobs, queue }
}

export function markProspectSearchBackgroundEnrichmentJob(
  queue: Map<string, ProspectSearchBackgroundEnrichmentJob>,
  jobId: string,
  patch: Partial<Pick<ProspectSearchBackgroundEnrichmentJob, "status" | "error_message">>,
): Map<string, ProspectSearchBackgroundEnrichmentJob> {
  const next = new Map(queue)
  const existing = next.get(jobId)
  if (!existing) return next
  next.set(jobId, { ...existing, ...patch })
  return next
}

export function pendingProspectSearchBackgroundEnrichmentJobs(
  queue: Map<string, ProspectSearchBackgroundEnrichmentJob>,
  limit = 10,
): ProspectSearchBackgroundEnrichmentJob[] {
  return [...queue.values()]
    .filter((job) => job.status === "pending")
    .sort((a, b) => a.enqueued_at.localeCompare(b.enqueued_at))
    .slice(0, limit)
}
