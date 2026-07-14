/** GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B — Buying committee suggestions via canonical path. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runBuyingCommitteeIntelligenceForCanonicalCompany } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-orchestrator"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { CallWorkspaceCommitteeSuggestion } from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"

export async function applyCallWorkspaceCommitteeSuggestions(
  admin: SupabaseClient,
  input: {
    leadId: string
    suggestions: CallWorkspaceCommitteeSuggestion[]
    sourceEventId: string
  },
): Promise<number> {
  const lead = await fetchGrowthLeadById(admin, input.leadId).catch(() => null)
  const companyId =
    (lead?.metadata?.canonical_company_id as string | undefined) ??
    (lead?.metadata?.canonicalCompanyId as string | undefined) ??
    null
  if (!companyId) return 0

  const highConfidence = input.suggestions.filter(
    (row) => row.canonicalPathQueued && row.confidence === "high" && !row.reviewRequired,
  )
  if (!highConfidence.length) return 0

  await runBuyingCommitteeIntelligenceForCanonicalCompany(admin, {
    company_id: companyId,
    promote: false,
  }).catch(() => undefined)

  return highConfidence.length
}
