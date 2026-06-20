import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  GROWTH_SENDR_PERSONALIZATION_VARIABLES,
  GROWTH_SENDR_VISITOR_PERSONALIZATION_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import {
  applySendrRuntimePersonalizationToPayload,
  growthLeadRecordToSendrVariables,
  type GrowthSendrPersonalizationContext,
} from "@/lib/growth/sendr/growth-sendr-personalization-runtime"
import type {
  GrowthSendrLandingPage,
  GrowthSendrPublicPagePayload,
  GrowthSendrPublicPagePersonalizationMeta,
} from "@/lib/growth/sendr/growth-sendr-types"
import { verifySendrVisitorTokenResult } from "@/lib/growth/sendr/growth-sendr-visitor-token"
import {
  hasSendrVisitorRenderContext,
  type SendrVisitorRenderContext,
} from "@/lib/growth/sendr/growth-sendr-visitor-render-context"

export type { SendrVisitorRenderContext }

export type SendrVisitorPersonalizationFallbackReason =
  | "invalid_lead"
  | "invalid_token"
  | "expired_token"
  | "org_mismatch"
  | "lead_not_found"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asTrimmed(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isLeadAuthorizedForPage(
  lead: { id: string; promotedOrganizationId: string | null },
  page: Pick<GrowthSendrLandingPage, "organizationId" | "leadId">,
): boolean {
  if (page.leadId === lead.id) return true
  return lead.promotedOrganizationId === page.organizationId
}

export async function resolveSendrVisitorLeadId(
  admin: SupabaseClient,
  page: Pick<GrowthSendrLandingPage, "id" | "organizationId" | "leadId">,
  renderContext?: SendrVisitorRenderContext | null,
): Promise<{
  leadId: string | null
  mode: GrowthSendrPublicPagePersonalizationMeta["mode"]
  fallbackReason: SendrVisitorPersonalizationFallbackReason | null
}> {
  if (!hasSendrVisitorRenderContext(renderContext)) {
    return { leadId: null, mode: "anonymous", fallbackReason: null }
  }

  let candidateLeadId = asTrimmed(renderContext?.leadId)
  let mode: GrowthSendrPublicPagePersonalizationMeta["mode"] = candidateLeadId ? "lead" : "anonymous"

  if (renderContext?.token) {
    const verified = verifySendrVisitorTokenResult(renderContext.token, page.id)
    if (!verified.ok) {
      return {
        leadId: null,
        mode: "token",
        fallbackReason: verified.reason === "page_mismatch" ? "invalid_token" : verified.reason,
      }
    }
    candidateLeadId = verified.leadId
    mode = "token"
  } else if (candidateLeadId && !UUID_RE.test(candidateLeadId)) {
    return { leadId: null, mode: "lead", fallbackReason: "invalid_lead" }
  }

  if (!candidateLeadId) {
    return { leadId: null, mode, fallbackReason: mode === "token" ? "invalid_token" : "invalid_lead" }
  }

  const lead = await fetchGrowthLeadById(admin, candidateLeadId)
  if (!lead) {
    return { leadId: null, mode, fallbackReason: "lead_not_found" }
  }
  if (!isLeadAuthorizedForPage(lead, page)) {
    return { leadId: null, mode, fallbackReason: "org_mismatch" }
  }

  return { leadId: lead.id, mode, fallbackReason: null }
}

export async function personalizeSendrPublicPagePayload(
  admin: SupabaseClient,
  input: {
    page: GrowthSendrLandingPage
    payload: GrowthSendrPublicPagePayload
    renderContext?: SendrVisitorRenderContext | null
  },
): Promise<GrowthSendrPublicPagePayload> {
  const resolution = await resolveSendrVisitorLeadId(admin, input.page, input.renderContext)
  if (!resolution.leadId) {
    if (!hasSendrVisitorRenderContext(input.renderContext)) {
      return input.payload
    }
    return {
      ...input.payload,
      personalization: {
        applied: false,
        mode: resolution.mode,
        fallbackReason: resolution.fallbackReason,
        missingVariables: [],
        qaMarker: GROWTH_SENDR_VISITOR_PERSONALIZATION_QA_MARKER,
      },
    }
  }

  const lead = await fetchGrowthLeadById(admin, resolution.leadId)
  const variables = growthLeadRecordToSendrVariables(
    lead ?? { contactName: null, companyName: null, city: null, state: null, metadata: {} },
    input.page.variableMap,
  )
  const customVariables = Object.fromEntries(
    Object.entries(input.page.variableMap).filter(
      ([key]) => !(GROWTH_SENDR_PERSONALIZATION_VARIABLES as readonly string[]).includes(key),
    ),
  )

  const context: GrowthSendrPersonalizationContext = {
    variables,
    fallbacks: input.page.variableMap,
    customVariables,
  }

  const { payload, missingVariables } = applySendrRuntimePersonalizationToPayload(input.payload, context)

  return {
    ...payload,
    personalization: {
      applied: true,
      mode: resolution.mode,
      fallbackReason: null,
      missingVariables,
      qaMarker: GROWTH_SENDR_VISITOR_PERSONALIZATION_QA_MARKER,
    },
  }
}

export { GROWTH_SENDR_VISITOR_PERSONALIZATION_QA_MARKER }
