import "server-only"

import {
  GE_V1_4_DEFAULT_BOOKING_PATH,
  type GeV14ProspectContext,
} from "@/lib/growth/demo-assistant/ge-v1-4-types"
import type { GrowthSendrPublicPagePayload } from "@/lib/growth/sendr/growth-sendr-types"
import type { SendrVisitorRenderContext } from "@/lib/growth/sendr/growth-sendr-visitor-render-context"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveSendrPublicPageContext } from "@/lib/growth/sendr/growth-sendr-public-page-service"

function resolveBookingUrl(meetingLink: string | null | undefined): string {
  const trimmed = meetingLink?.trim()
  if (trimmed) {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
    if (trimmed.startsWith("/")) return trimmed
    return `/${trimmed}`
  }
  return GE_V1_4_DEFAULT_BOOKING_PATH
}

function extractPersonalizationFromPayload(
  payload: GrowthSendrPublicPagePayload,
): Partial<GeV14ProspectContext> {
  const hero = payload.sections.find((s) => s.type === "hero")?.content ?? {}
  const prospectName =
    typeof hero.firstName === "string"
      ? hero.firstName.trim()
      : typeof hero.prospectName === "string"
        ? hero.prospectName.trim()
        : null

  return {
    prospectName,
    company:
      typeof hero.companyName === "string"
        ? hero.companyName.trim()
        : typeof hero.company === "string"
          ? hero.company.trim()
          : null,
    role: typeof hero.jobTitle === "string" ? hero.jobTitle.trim() : null,
    industry: typeof hero.industry === "string" ? hero.industry.trim() : null,
    personalizedPageTitle: payload.title,
    meetingLink: payload.booking?.meetingLink ?? null,
    senderName: typeof hero.ownerName === "string" ? hero.ownerName.trim() : null,
    bookingUrl: resolveBookingUrl(payload.booking?.meetingLink),
  }
}

export async function resolveGeV14ProspectContext(
  admin: SupabaseClient,
  input: {
    slug: string
    payload?: GrowthSendrPublicPagePayload
    renderContext?: SendrVisitorRenderContext
  },
): Promise<
  | {
      ok: true
      organizationId: string
      landingPageId: string
      leadId: string | null
      context: GeV14ProspectContext
    }
  | { ok: false; error: string }
> {
  const pageCtx = await resolveSendrPublicPageContext(admin, input.slug, input.renderContext)
  if (!pageCtx) return { ok: false, error: "not_found" }

  const fromPayload = input.payload ? extractPersonalizationFromPayload(input.payload) : {}
  let leadFields: Partial<GeV14ProspectContext> = {}

  if (pageCtx.leadId) {
    const lead = await fetchGrowthLeadById(admin, pageCtx.leadId)
    if (lead) {
      leadFields = {
        prospectName: lead.firstName
          ? [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() || null
          : null,
        company: lead.companyName ?? null,
        role: lead.jobTitle ?? null,
        industry: lead.industry ?? null,
      }
    }
  }

  const meetingLink = fromPayload.meetingLink ?? leadFields.meetingLink ?? null

  const context: GeV14ProspectContext = {
    prospectName: fromPayload.prospectName ?? leadFields.prospectName ?? null,
    company: fromPayload.company ?? leadFields.company ?? null,
    role: fromPayload.role ?? leadFields.role ?? null,
    industry: fromPayload.industry ?? leadFields.industry ?? null,
    personalizedPageTitle: fromPayload.personalizedPageTitle ?? null,
    meetingLink,
    senderName: fromPayload.senderName ?? null,
    senderCompany: "Equipify",
    bookingUrl: resolveBookingUrl(meetingLink),
  }

  return {
    ok: true,
    organizationId: pageCtx.organizationId,
    landingPageId: pageCtx.landingPageId,
    leadId: pageCtx.leadId,
    context,
  }
}

export function buildRetellDemoSystemPrompt(context: GeV14ProspectContext): string {
  const lines = [
    "You are the Equipify Demo Assistant — a knowledgeable sales engineer for Equipify field service software.",
    "Answer concisely and accurately about Equipify capabilities.",
    "Never quote specific pricing — recommend a demo for pricing questions.",
    "Never promise unsupported features or integrations.",
    "Never create meetings outside the booking link provided.",
    "When appropriate, suggest booking a demo without being pushy.",
  ]

  if (context.prospectName) lines.push(`Prospect name: ${context.prospectName}`)
  if (context.company) lines.push(`Company: ${context.company}`)
  if (context.role) lines.push(`Role: ${context.role}`)
  if (context.industry) lines.push(`Industry: ${context.industry}`)
  if (context.bookingUrl) lines.push(`Demo booking URL: ${context.bookingUrl}`)

  return lines.join("\n")
}
