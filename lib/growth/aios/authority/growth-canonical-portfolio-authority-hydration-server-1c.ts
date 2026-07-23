/**
 * AVA-GROWTH-OPERATOR-1C — Server-side portfolio authority + escalation hydration.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCanonicalOpportunityAuthorityMap,
  type GrowthCanonicalOpportunityAuthorityMap,
} from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-1b"
import {
  buildEscalationAgreementSnapshot,
  recordEscalationAgreementRow,
  type GrowthEscalationAgreementSnapshot,
} from "@/lib/growth/aios/authority/growth-canonical-escalation-authority-1c"
import type { GrowthConstitutionalPortfolioEscalationMap } from "@/lib/growth/aios/authority/growth-constitutional-portfolio-escalation-1c"
import { buildConstitutionalEscalationMapFromPortfolioLeads } from "@/lib/growth/aios/authority/growth-constitutional-portfolio-escalation-1c"
import { resolveGrowthCanonicalDecisionForLeadCached } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import type { GrowthLead } from "@/lib/growth/types"
import type { RunWorkManagerInput } from "@/lib/growth/work-manager/manager/run-work-manager"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

export const GROWTH_PORTFOLIO_AUTHORITY_HYDRATION_1C_QA_MARKER =
  "ava-growth-operator-1c-portfolio-authority-hydration-v1" as const

const DEFAULT_MAX_LEADS = 48

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await mapper(items[current])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function hydrateCanonicalPortfolioAuthority(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadIds: string[]
    generatedAt?: string
    maxLeads?: number
    portfolioLeads?: GrowthLead[] | null
  },
): Promise<{
  authorityByLeadId: GrowthCanonicalOpportunityAuthorityMap
  constitutionalEscalationByLeadId: GrowthConstitutionalPortfolioEscalationMap
  telemetry: GrowthEscalationAgreementSnapshot
}> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const leadIds = input.leadIds.slice(0, input.maxLeads ?? DEFAULT_MAX_LEADS)
  const constitutionalEscalationByLeadId = buildConstitutionalEscalationMapFromPortfolioLeads(
    input.portfolioLeads ?? null,
  )

  const resolutions = await mapWithConcurrency(leadIds, 6, async (leadId) =>
    resolveGrowthCanonicalDecisionForLeadCached(admin, {
      organizationId: input.organizationId,
      leadId,
      generatedAt,
    }).catch(() => null),
  )

  const authorityByLeadId = buildCanonicalOpportunityAuthorityMap(resolutions)

  const telemetryRows = leadIds.map((leadId) => {
    const authority = authorityByLeadId[leadId] ?? null
    const constitutional = constitutionalEscalationByLeadId[leadId]
    const subsystemWouldInterrupt = constitutional?.interruptOperator === true

    return recordEscalationAgreementRow({
      leadId,
      subsystem: "portfolio_hydration",
      requestKind: authority?.operatorReviewRequired ? "outbound_send_ready" : "prepare_outreach",
      subsystemWouldInterrupt,
      opportunityAuthority: authority,
    })
  })

  return {
    authorityByLeadId,
    constitutionalEscalationByLeadId,
    telemetry: buildEscalationAgreementSnapshot({ generatedAt, rows: telemetryRows }),
  }
}

export async function runWorkManagerWithPortfolioAuthority(
  admin: SupabaseClient,
  input: RunWorkManagerInput & {
    organizationId: string
    portfolioLeads?: GrowthLead[] | null
    maxHydrationLeads?: number
  },
): Promise<{
  workResult: AvaWorkManagerResult
  authorityByLeadId: GrowthCanonicalOpportunityAuthorityMap
  telemetry: GrowthEscalationAgreementSnapshot
}> {
  const leadIds = (input.portfolioLeads ?? [])
    .map((lead) => lead.id)
    .filter(Boolean)

  const hydration = await hydrateCanonicalPortfolioAuthority(admin, {
    organizationId: input.organizationId,
    leadIds,
    generatedAt: input.generatedAt,
    maxLeads: input.maxHydrationLeads,
    portfolioLeads: input.portfolioLeads ?? null,
  })

  const workResult = runWorkManager({
    ...input,
    canonicalAuthorityByLeadId: hydration.authorityByLeadId,
  })

  return {
    workResult,
    authorityByLeadId: hydration.authorityByLeadId,
    telemetry: hydration.telemetry,
  }
}
