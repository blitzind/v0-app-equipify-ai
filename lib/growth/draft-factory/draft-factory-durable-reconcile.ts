/**
 * SV1-5A — Non-destructive Draft Factory state reconciliation for one organization.
 * Does not trigger paid work. Dry-run by default.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { reconstructDraftFactoryStateFromCanonicalData } from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import { buildCanonicalEvidenceForLead } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { createPostgresDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository"
import { AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER } from "@/lib/growth/draft-factory/draft-factory-durable-types"

export const EQUIPIFY_GROWTH_TEST_ORG_ID = "5876176a-61ec-4532-ad99-0c31482d5a91" as const

export type DraftFactoryReconciliationCounts = {
  totalLeadsInspected: number
  rowsAlreadyPresent: number
  rowsReconstructed: number
  waiting_for_research: number
  waiting_for_dm: number
  waiting_for_contact_verification: number
  waiting_for_personalization: number
  waiting_for_generation: number
  waiting_for_approval: number
  stopped: number
  deferred: number
  failed: number
  skippedStopInvestment: number
}

export async function reconcileDraftFactoryStatesForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dryRun?: boolean
    limit?: number
    now?: string
  },
): Promise<{
  qaMarker: typeof AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER
  organizationId: string
  dryRun: boolean
  counts: DraftFactoryReconciliationCounts
}> {
  const dryRun = input.dryRun !== false
  const now = input.now ?? new Date().toISOString()
  const repo = createPostgresDraftFactoryRepository(admin)
  const available = await repo.assertAvailable?.()
  if (available && !available.ok) {
    throw new Error(available.reason)
  }

  const { data: leads, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .limit(input.limit ?? 5000)
  if (error) throw new Error(error.message)

  const counts: DraftFactoryReconciliationCounts = {
    totalLeadsInspected: 0,
    rowsAlreadyPresent: 0,
    rowsReconstructed: 0,
    waiting_for_research: 0,
    waiting_for_dm: 0,
    waiting_for_contact_verification: 0,
    waiting_for_personalization: 0,
    waiting_for_generation: 0,
    waiting_for_approval: 0,
    stopped: 0,
    deferred: 0,
    failed: 0,
    skippedStopInvestment: 0,
  }

  for (const row of leads ?? []) {
    const leadId = String((row as { id: string }).id)
    counts.totalLeadsInspected += 1

    const existing = await repo.getLeadState(input.organizationId, leadId)
    if (existing) {
      counts.rowsAlreadyPresent += 1
      bumpStateCount(counts, existing.state)
      continue
    }

    const evidence = await buildCanonicalEvidenceForLead(admin, {
      organizationId: input.organizationId,
      leadId,
      portfolioSelected: false,
    })

    if (evidence.stopInvestment) {
      counts.skippedStopInvestment += 1
      counts.stopped += 1
      // Still reconstruct paused/stopped row without waking paid work when applying.
    }

    const reconstructed = reconstructDraftFactoryStateFromCanonicalData({
      organizationId: input.organizationId,
      leadId,
      evidence: {
        ...evidence,
        // Avoid implying portfolio spend — reconstruction is observational.
        portfolioSelected: false,
      },
      now,
    })

    bumpStateCount(counts, reconstructed.state)
    if (!evidence.stopInvestment) {
      // deferred portfolio until capacity wake
      if (reconstructed.earliestIncompleteStage === "portfolio" || reconstructed.state === "paused") {
        counts.deferred += 1
      }
    }

    if (!dryRun) {
      await repo.upsertLeadState(reconstructed)
      counts.rowsReconstructed += 1
    } else {
      counts.rowsReconstructed += 1 // would reconstruct
    }
  }

  return {
    qaMarker: AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
    organizationId: input.organizationId,
    dryRun,
    counts,
  }
}

function bumpStateCount(counts: DraftFactoryReconciliationCounts, state: string): void {
  if (state === "waiting_for_research" || state === "research_complete") counts.waiting_for_research += 1
  else if (state === "waiting_for_dm") counts.waiting_for_dm += 1
  else if (state === "waiting_for_contact_verification") counts.waiting_for_contact_verification += 1
  else if (state === "waiting_for_personalization") counts.waiting_for_personalization += 1
  else if (state === "waiting_for_generation") counts.waiting_for_generation += 1
  else if (state === "waiting_for_approval" || state === "draft_ready") counts.waiting_for_approval += 1
  else if (state === "paused") counts.stopped += 1
  else if (state === "failed") counts.failed += 1
}
