/** Client execute — human acquisition pipeline API (7.PS-HA-FIX). */

import { GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-human-acquisition-types"
import type { GrowthProspectSearchActionableResearchExecuteResult } from "@/lib/growth/prospect-search/prospect-search-actionable-research-types"

export async function executeProspectSearchHumanAcquisition(input: {
  companyCandidateId: string
  canonicalCompanyId?: string | null
}): Promise<GrowthProspectSearchActionableResearchExecuteResult> {
  const res = await fetch("/api/platform/growth/prospect-search/human-acquisition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_candidate_id: input.companyCandidateId,
      canonical_company_id: input.canonicalCompanyId ?? null,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    qa_marker?: string
    message?: string
    discovery_contacts?: number
    backfill_persons_linked?: number
  }

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      lane: "legacy_contact_discovery",
      enqueued: false,
      message: data.message ?? "Human acquisition failed.",
    }
  }

  const linked = data.backfill_persons_linked ?? 0
  const discovered = data.discovery_contacts ?? 0
  return {
    ok: true,
    lane: "legacy_contact_discovery",
    enqueued: discovered > 0 || linked > 0,
    message:
      data.message ??
      `Human acquisition complete (${GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER}).`,
  }
}
