/** Phase 7.PS-HS — Prospect graph expansion orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER,
  type GrowthProspectGraphExpansionCycleResult,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-types"
import {
  diffProspectGraphExpansionMetrics,
  loadProspectGraphExpansionMetrics,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-metrics"
import {
  type ProspectGraphAnchorCompany,
  processProspectGraphAcquisitionQueue,
  queueProspectGraphAcquisitionJobs,
  runProspectGraphAcquisitionForCompany,
} from "@/lib/growth/graph-expansion/prospect-continuous-acquisition"

function estimateOutreachReadyInventory(metrics: {
  named_persons_total: number
  verified_emails_total: number
  verified_phones_total: number
  companies_total: number
}): number {
  const namedWithChannel = Math.min(
    metrics.named_persons_total,
    metrics.verified_emails_total + metrics.verified_phones_total,
  )
  return Math.max(0, Math.min(metrics.companies_total, namedWithChannel))
}

export async function runProspectGraphExpansionCycle(
  admin: SupabaseClient,
  input: {
    anchor_companies: ProspectGraphAnchorCompany[]
    industry_contains?: string | null
    queue_jobs?: boolean
    process_queue_limit?: number
    direct_anchor_acquisition?: boolean
  },
): Promise<GrowthProspectGraphExpansionCycleResult> {
  const messages: string[] = []
  const companyIds = input.anchor_companies.map((a) => a.canonical_company_id)

  const before = await loadProspectGraphExpansionMetrics(admin, {
    company_ids: companyIds,
    industry_contains: input.industry_contains,
  })

  let jobs_queued = 0
  if (input.queue_jobs !== false) {
    jobs_queued = await queueProspectGraphAcquisitionJobs(admin, {
      anchor_companies: input.anchor_companies,
      include_discovery_segments: true,
    })
    messages.push(`queued_jobs:${jobs_queued}`)
  }

  let jobs_processed = 0
  let jobs_failed = 0
  let discovery_new_companies = 0
  let evidence_versions_created = 0

  if (input.direct_anchor_acquisition !== false) {
    for (const anchor of input.anchor_companies) {
      const result = await runProspectGraphAcquisitionForCompany(admin, anchor)
      jobs_processed += 1
      if (!result.ok) jobs_failed += 1
      if (result.evidence_version_id) evidence_versions_created += 1
      messages.push(`${anchor.company_name}: contacts=${result.website_contacts_synced}`)
    }
  }

  const queueResult = await processProspectGraphAcquisitionQueue(admin, {
    anchor_companies: input.anchor_companies,
    limit: input.process_queue_limit ?? 12,
  })
  jobs_processed += queueResult.processed
  jobs_failed += queueResult.failed
  discovery_new_companies += queueResult.discovery_new_companies
  evidence_versions_created += queueResult.evidence_versions_created
  messages.push(...queueResult.messages.slice(0, 6))

  const after = await loadProspectGraphExpansionMetrics(admin, {
    company_ids: companyIds,
    industry_contains: input.industry_contains,
  })

  const outreach_before = estimateOutreachReadyInventory(before.metrics)
  const outreach_after = estimateOutreachReadyInventory(after.metrics)

  const metrics_delta = diffProspectGraphExpansionMetrics(before.metrics, after.metrics)
  const ok =
    (after.metrics.companies_total > before.metrics.companies_total ||
      after.metrics.persons_total > before.metrics.persons_total ||
      after.metrics.named_persons_total > before.metrics.named_persons_total ||
      after.metrics.titles_total > before.metrics.titles_total ||
      after.metrics.verified_emails_total > before.metrics.verified_emails_total ||
      after.metrics.verified_phones_total > before.metrics.verified_phones_total ||
      after.metrics.committee_members_verified > before.metrics.committee_members_verified ||
      after.metrics.named_person_density_pct > before.metrics.named_person_density_pct) &&
    after.metrics.named_person_density_pct >= before.metrics.named_person_density_pct

  return {
    qa_marker: GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER,
    ok,
    jobs_queued,
    jobs_processed,
    jobs_failed,
    discovery_new_companies,
    metrics_before: before.metrics,
    metrics_after: after.metrics,
    metrics_delta,
    evidence_versions_created,
    outreach_ready_estimate: {
      before: outreach_before,
      after: outreach_after,
      delta: outreach_after - outreach_before,
    },
    messages,
  }
}
