/** Prospect Search — execute Growth Engine research jobs from the UI (7.PS-C). Client-only fetch. */

import {
  buildGrowthEngineJobRequestBody,
  buildProspectSearchActionableResearchPlan,
  formatGrowthEngineEnqueueMessage,
  growthEngineJobEndpoint,
} from "@/lib/growth/prospect-search/prospect-search-actionable-research"
import type { GrowthProspectSearchActionableResearchExecuteResult } from "@/lib/growth/prospect-search/prospect-search-actionable-research-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export async function executeProspectSearchLegacyContactDiscovery(
  companyCandidateId: string,
): Promise<{ ok: boolean; message: string }> {
  const params = new URLSearchParams({ company_candidate_id: companyCandidateId, run: "1" })
  const res = await fetch(`/api/platform/growth/contact-discovery?${params}`, { cache: "no-store" })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    return {
      ok: false,
      message: data.message ?? "Website contact discovery failed.",
    }
  }
  return {
    ok: true,
    message: "Website contact discovery started — refresh results when complete.",
  }
}

export async function executeProspectSearchActionableResearch(input: {
  company: GrowthProspectSearchCompanyResult
  actionKind: string
  personId?: string | null
  companyCandidateId: string
}): Promise<GrowthProspectSearchActionableResearchExecuteResult> {
  const plan = buildProspectSearchActionableResearchPlan({
    company: input.company,
    actionKind: input.actionKind,
    personId: input.personId,
  })

  if (!plan.can_execute) {
    if (plan.lane === "legacy_contact_discovery") {
      const legacy = await executeProspectSearchLegacyContactDiscovery(input.companyCandidateId)
      return {
        ok: legacy.ok,
        lane: "legacy_contact_discovery",
        enqueued: legacy.ok,
        message: legacy.message,
      }
    }
    return {
      ok: false,
      lane: plan.lane,
      enqueued: false,
      message: plan.blocked_reason ?? "Cannot queue this research action.",
    }
  }

  if (plan.lane === "legacy_contact_discovery") {
    const legacy = await executeProspectSearchLegacyContactDiscovery(input.companyCandidateId)
    return {
      ok: legacy.ok,
      lane: plan.lane,
      enqueued: legacy.ok,
      message: legacy.message,
    }
  }

  const endpoint = growthEngineJobEndpoint(plan.lane)
  const body = buildGrowthEngineJobRequestBody(plan)
  if (!endpoint || !body) {
    const legacy = await executeProspectSearchLegacyContactDiscovery(input.companyCandidateId)
    return {
      ok: legacy.ok,
      lane: "legacy_contact_discovery",
      enqueued: legacy.ok,
      message: legacy.message,
    }
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    enqueued?: boolean
    reason?: string | null
    message?: string
    job_id?: string | null
  }

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      lane: plan.lane,
      enqueued: false,
      message: formatGrowthEngineEnqueueMessage({
        lane: plan.lane,
        enqueued: false,
        reason: data.reason,
        message: data.message ?? "Could not queue Growth Engine job.",
      }),
      reason: data.reason ?? null,
    }
  }

  return {
    ok: true,
    lane: plan.lane,
    enqueued: Boolean(data.enqueued),
    message: formatGrowthEngineEnqueueMessage({
      lane: plan.lane,
      enqueued: Boolean(data.enqueued),
      reason: data.reason,
      message: data.message,
    }),
    job_id: data.job_id ?? null,
    reason: data.reason ?? null,
  }
}
