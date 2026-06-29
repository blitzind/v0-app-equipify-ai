import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { isCommunicationStrategyEnabled } from "@/lib/growth/contact-verification/communication-strategy-feature"
import { resolveLeadCommunicationStrategyBundle } from "@/lib/growth/contact-verification/lead-communication-strategy-resolver"
import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const lead_id = leadId?.trim()
  if (!lead_id) {
    return NextResponse.json({ ok: false, message: "leadId is required." }, { status: 400 })
  }

  const enabled =
    isNativeRevenueDecisionEngineEnabled() || isCommunicationStrategyEnabled()
  if (!enabled) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      display_summary: null,
      communication_strategy: null,
      relationship_recommendation: null,
    })
  }

  const lead = await fetchGrowthLeadById(access.admin, lead_id)
  if (!lead) {
    return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 404 })
  }

  const resolved = await resolveLeadCommunicationStrategyBundle(lead, {
    organizationId: getGrowthEngineAiOrgId(),
  })

  return NextResponse.json({
    ok: true,
    enabled: resolved.enabled,
    display_summary: resolved.bundle?.display_summary ?? null,
    communication_strategy: resolved.bundle?.communication_strategy_display ?? null,
    relationship_recommendation: resolved.bundle?.relationship_recommendation ?? null,
    command_center_recommendation: resolved.bundle?.command_center_recommendation ?? null,
  })
}
