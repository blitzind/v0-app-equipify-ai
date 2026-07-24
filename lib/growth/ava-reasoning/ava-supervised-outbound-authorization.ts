/**
 * AVA-SUPERVISED-OUTBOUND-1B — Authorization checks for supervised Ava send (server-only).
 */

import "server-only"

import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { isLeadInPortfolioOrganizationScope } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { isAvaSupervisedOutboundGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"

export type AvaSupervisedOutboundAuthorizationResult =
  | { ok: true; organizationId: string }
  | { ok: false; code: string; message: string }

export async function assertAvaSupervisedOutboundSendAuthorized(
  admin: SupabaseClient,
  input: {
    generation: GrowthAiCopilotGeneration
    actorOrganizationId: string | null
    isPlatformAdmin: boolean
  },
): Promise<AvaSupervisedOutboundAuthorizationResult> {
  if (!isAvaSupervisedOutboundGeneration(input.generation)) {
    return {
      ok: false,
      code: "not_ava_supervised_generation",
      message: "This send path is limited to supervised Ava direct drafts.",
    }
  }

  const lead = await fetchGrowthLeadById(admin, input.generation.leadId)
  if (!lead) {
    return { ok: false, code: "lead_not_found", message: "Lead not found for this generation." }
  }

  const organizationId =
    input.actorOrganizationId?.trim() ||
    lead.promotedOrganizationId?.trim() ||
    getGrowthEngineAiOrgId()?.trim() ||
    null

  if (!organizationId) {
    return {
      ok: false,
      code: "organization_unavailable",
      message: "Organization context is required to send supervised Ava outbound.",
    }
  }

  if (!input.isPlatformAdmin && !isLeadInPortfolioOrganizationScope(lead, organizationId)) {
    return {
      ok: false,
      code: "tenant_isolation_violation",
      message: "This generation is outside your organization scope.",
    }
  }

  return { ok: true, organizationId }
}
