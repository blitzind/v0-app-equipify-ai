import {
  GROWTH_SENDR_PERSONALIZATION_VARIABLES,
  type GrowthSendrPersonalizationVariable,
} from "@/lib/growth/sendr/growth-sendr-config"
import type {
  GrowthSendrPublicPagePayload,
  GrowthSendrPublicPageSection,
} from "@/lib/growth/sendr/growth-sendr-types"

export type GrowthSendrVariableMap = Partial<
  Record<GrowthSendrPersonalizationVariable | string, string>
>

export type GrowthSendrPersonalizationContext = {
  variables: GrowthSendrVariableMap
  fallbacks?: GrowthSendrVariableMap
  customVariables?: Record<string, string>
}

const VARIABLE_PATTERN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

/** Deterministic server-side merge — no AI, no realtime recompute. */
export function resolveSendrPersonalizationVariables(
  context: GrowthSendrPersonalizationContext,
): Record<string, string> {
  const resolved: Record<string, string> = {}
  for (const key of GROWTH_SENDR_PERSONALIZATION_VARIABLES) {
    const primary = context.variables[key]
    resolved[key] =
      primary && primary.length > 0
        ? primary
        : (context.fallbacks?.[key] ?? "")
  }
  if (context.customVariables) {
    for (const [key, value] of Object.entries(context.customVariables)) {
      resolved[key] = value
    }
  }
  return resolved
}

export function renderSendrPersonalizedText(
  template: string,
  context: GrowthSendrPersonalizationContext,
): string {
  const map = resolveSendrPersonalizationVariables(context)
  return template.replace(VARIABLE_PATTERN, (_match, key: string) => {
    if (key === "custom_variables") return ""
    return map[key] ?? context.fallbacks?.[key] ?? ""
  })
}

export function extractSendrVariablePlaceholders(template: string): string[] {
  const found = new Set<string>()
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    if (match[1]) found.add(match[1])
  }
  return [...found]
}

export function buildSendrCachedVariableMap(
  lead: Record<string, unknown> | null | undefined,
  owner: Record<string, unknown> | null | undefined,
  extras?: GrowthSendrVariableMap,
): GrowthSendrVariableMap {
  return {
    first_name: String(lead?.first_name ?? lead?.firstName ?? ""),
    last_name: String(lead?.last_name ?? lead?.lastName ?? ""),
    company_name: String(lead?.company_name ?? lead?.companyName ?? ""),
    industry: String(lead?.industry ?? ""),
    job_title: String(lead?.job_title ?? lead?.jobTitle ?? ""),
    city: String(lead?.city ?? ""),
    state: String(lead?.state ?? ""),
    owner_name: String(owner?.full_name ?? owner?.name ?? ""),
    meeting_link: String(extras?.meeting_link ?? lead?.meeting_link ?? lead?.meetingLink ?? ""),
    ...extras,
  }
}

/** Map Growth lead fields into SENDR variable keys without exposing PII in URLs. */
export function growthLeadRecordToSendrVariables(
  lead: {
    contactName?: string | null
    companyName?: string | null
    city?: string | null
    state?: string | null
    metadata?: Record<string, unknown> | null
  },
  extras?: GrowthSendrVariableMap,
): GrowthSendrVariableMap {
  const meta = lead.metadata ?? {}
  const contact = lead.contactName?.trim() ?? ""
  const parts = contact.split(/\s+/).filter(Boolean)
  const firstFromName = parts[0] ?? ""
  const lastFromName = parts.length > 1 ? parts.slice(1).join(" ") : ""

  const ctaLabel = String(meta.cta_label ?? meta.custom_cta_label ?? meta.sendr_cta_label ?? "")
  const ctaHref = String(meta.cta_href ?? meta.custom_cta_href ?? meta.sendr_cta_href ?? "")
  const meetingLink = String(meta.meeting_link ?? meta.meetingLink ?? meta.sendr_meeting_link ?? "")

  return buildSendrCachedVariableMap(
    {
      first_name: meta.first_name ?? meta.firstName ?? firstFromName,
      last_name: meta.last_name ?? meta.lastName ?? lastFromName,
      company_name: lead.companyName ?? "",
      industry: meta.industry ?? "",
      job_title: meta.job_title ?? meta.jobTitle ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      meeting_link: meetingLink,
    },
    null,
    {
      ...extras,
      ...(ctaLabel ? { cta_label: ctaLabel } : {}),
      ...(ctaHref ? { cta_href: ctaHref } : {}),
      ...(meetingLink ? { meeting_link: meetingLink } : {}),
    },
  )
}

function renderSectionContent(
  content: Record<string, unknown>,
  context: GrowthSendrPersonalizationContext,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...content }
  for (const key of ["headline", "body", "label", "href", "html", "question", "answer"]) {
    if (typeof next[key] === "string") {
      next[key] = renderSendrPersonalizedText(next[key], context)
    }
  }
  if (Array.isArray(next.items)) {
    next.items = next.items.map((item) => {
      const row = { ...(item as Record<string, unknown>) }
      if (typeof row.question === "string") {
        row.question = renderSendrPersonalizedText(row.question, context)
      }
      if (typeof row.answer === "string") {
        row.answer = renderSendrPersonalizedText(row.answer, context)
      }
      return row
    })
  }
  return next
}

function applyResolvedOverridesToSection(
  section: GrowthSendrPublicPageSection,
  resolved: Record<string, string>,
): GrowthSendrPublicPageSection {
  if (section.type !== "cta" && section.type !== "calendar") return section
  const content = { ...section.content }
  const ctaLabel = resolved.cta_label?.trim()
  const ctaHref = resolved.cta_href?.trim()
  const meetingLink = resolved.meeting_link?.trim()
  if (ctaLabel) content.label = ctaLabel
  if (ctaHref) content.href = ctaHref
  else if (meetingLink && !content.href) content.href = meetingLink
  return { ...section, content }
}

export function applySendrRuntimePersonalizationToPayload(
  payload: GrowthSendrPublicPagePayload,
  context: GrowthSendrPersonalizationContext,
): {
  payload: GrowthSendrPublicPagePayload
  missingVariables: string[]
} {
  const resolved = resolveSendrPersonalizationVariables(context)
  const overrideValues = {
    ...context.variables,
    ...context.customVariables,
    ...resolved,
  }
  const missingVariables = GROWTH_SENDR_PERSONALIZATION_VARIABLES.filter((key) => !resolved[key]?.trim())

  const title = renderSendrPersonalizedText(payload.title, context)
  const sections = payload.sections.map((section) => {
    const rendered = {
      ...section,
      content: renderSectionContent(section.content, context),
    }
    return applyResolvedOverridesToSection(rendered, overrideValues)
  })

  let booking = payload.booking
  const meetingLink = overrideValues.meeting_link?.trim()
  if (meetingLink) {
    booking = booking
      ? { ...booking, meetingLink }
      : {
          meetingLink,
          meetingType: null,
          durationMinutes: null,
          timezone: null,
        }
  }

  return {
    payload: {
      ...payload,
      title,
      sections,
      booking,
    },
    missingVariables,
  }
}
