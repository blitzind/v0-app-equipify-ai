import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listContentVariables } from "@/lib/growth/content/snippet-repository"
import {
  buildVariableExampleMap,
  buildVariableFallbackMap,
} from "@/lib/growth/content/variable-registry"
import { resolveCompanyCandidateContext } from "@/lib/growth/contact-discovery/contact-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { GrowthVideoMergeContextResult } from "@/lib/growth/videos/growth-video-types"
import {
  buildGrowthVideoAliasMergeMap,
  buildGrowthVideoAliasResolutionReport,
  resolveGrowthVideoVariableAlias,
} from "@/lib/growth/videos/growth-video-variable-alias-service"

export type ResolveGrowthVideoMergeContextInput = {
  admin: SupabaseClient
  organizationId: string
  leadId?: string | null
  companyCandidateId?: string | null
  personCandidateId?: string | null
  personalizationProfileId?: string | null
  /** Operator overrides from `video_pages.personalization_json`. */
  pagePersonalization?: {
    variables?: Record<string, string>
    previewContext?: Record<string, string>
  } | null
  /** Static page fields used for cta/calendar alias resolution. */
  pageFields?: {
    ctaUrl?: string | null
    calendarUrl?: string | null
  } | null
  /** Preview form values (admin preview tab). */
  previewForm?: Record<string, string> | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function splitContactName(contactName: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = contactName?.trim() ?? ""
  if (!trimmed) return { firstName: "", lastName: "" }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") }
}

function normalizeVariableMap(input: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!key.trim()) continue
    map[key.trim().toLowerCase()] = value
  }
  return map
}

async function loadPersonalizationProfileScore(
  admin: SupabaseClient,
  profileId: string,
): Promise<{ score: number; leadId: string | null } | null> {
  const { data } = await admin
    .schema("growth")
    .from("personalization_profiles")
    .select("personalization_score, lead_id")
    .eq("id", profileId)
    .maybeSingle()
  if (!data) return null
  const row = data as Record<string, unknown>
  return {
    score: Number(row.personalization_score) || 0,
    leadId: asString(row.lead_id) || null,
  }
}

async function loadPersonCandidate(
  admin: SupabaseClient,
  personCandidateId: string,
): Promise<Record<string, string>> {
  const { data } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("full_name, first_name, last_name, email, job_title, city, state, country")
    .eq("id", personCandidateId)
    .maybeSingle()
  if (!data) return {}
  const row = data as Record<string, unknown>
  const fullName = asString(row.full_name)
  const split = splitContactName(fullName || `${asString(row.first_name)} ${asString(row.last_name)}`.trim())
  return normalizeVariableMap({
    "lead.contact_name": fullName || `${split.firstName} ${split.lastName}`.trim(),
    "lead.first_name": asString(row.first_name) || split.firstName,
    "lead.last_name": asString(row.last_name) || split.lastName,
    "lead.email": asString(row.email),
    "lead.title": asString(row.job_title),
    "lead.city": asString(row.city),
    "lead.state": asString(row.state),
    "lead.country": asString(row.country),
  })
}

function buildVariablesFromLead(lead: Awaited<ReturnType<typeof fetchGrowthLeadById>>): Record<string, string> {
  if (!lead) return {}
  const split = splitContactName(lead.contactName)
  const meta = lead.metadata ?? {}
  const industry =
    asString(meta.industry) ||
    asString(meta.industry_label) ||
    asString(meta.vertical) ||
    ""
  const title = asString(meta.title) || asString(meta.job_title) || ""
  const painPoint =
    asString(meta.pain_point) ||
    asString(meta.top_pain_point) ||
    ""

  return normalizeVariableMap({
    "lead.contact_name": lead.contactName ?? "",
    "lead.first_name": split.firstName,
    "lead.last_name": split.lastName,
    "lead.company_name": lead.companyName,
    "lead.email": lead.contactEmail ?? "",
    "lead.industry": industry,
    "lead.title": title,
    "lead.city": lead.city ?? "",
    "lead.state": lead.state ?? "",
    "lead.country": lead.country ?? "",
    "lead.pain_point": painPoint,
  })
}

function buildPreviewFormVariables(previewForm: Record<string, string> | null | undefined): Record<string, string> {
  if (!previewForm) return {}
  return normalizeVariableMap({
    "lead.first_name": previewForm.firstName ?? previewForm.first_name ?? "",
    "lead.last_name": previewForm.lastName ?? previewForm.last_name ?? "",
    "lead.contact_name":
      previewForm.fullName ??
      previewForm.full_name ??
      [previewForm.firstName ?? previewForm.first_name, previewForm.lastName ?? previewForm.last_name]
        .filter(Boolean)
        .join(" "),
    "lead.company_name": previewForm.company ?? "",
    "lead.title": previewForm.title ?? "",
    "lead.industry": previewForm.industry ?? "",
    "lead.city": previewForm.city ?? "",
    "lead.state": previewForm.state ?? "",
    "lead.country": previewForm.country ?? "",
    "lead.email": previewForm.email ?? "",
    "lead.pain_point": previewForm.painPoint ?? previewForm.pain_point ?? "",
    "sender.name": previewForm.senderName ?? previewForm.sender_name ?? "",
    "sender.company": previewForm.senderCompany ?? previewForm.sender_company ?? "",
    "sender.email": previewForm.senderEmail ?? previewForm.sender_email ?? "",
    "booking.link": previewForm.bookingLink ?? previewForm.calendarUrl ?? previewForm.calendar_url ?? "",
    "lead.cta_url": previewForm.ctaUrl ?? previewForm.cta_url ?? "",
  })
}

function detectMissingVariables(
  mergeMap: Record<string, string>,
  fallbacks: Record<string, string>,
  requiredKeys: string[],
): string[] {
  const missing: string[] = []
  for (const key of requiredKeys) {
    const normalized = key.toLowerCase()
    const canonical = resolveGrowthVideoVariableAlias(normalized)
    const value = mergeMap[normalized] ?? mergeMap[canonical]
    if (!value?.trim()) {
      missing.push(canonical)
    } else if (value === fallbacks[canonical]) {
      missing.push(canonical)
    }
  }
  return [...new Set(missing)]
}

export async function resolveGrowthVideoMergeContext(
  input: ResolveGrowthVideoMergeContextInput,
): Promise<GrowthVideoMergeContextResult> {
  const sourcesUsed: string[] = ["content_variable_registry"]
  const variables: Record<string, string> = {}

  const registryVariables = await listContentVariables(input.admin)
  const exampleMap = buildVariableExampleMap(registryVariables)
  const fallbackMap = buildVariableFallbackMap(registryVariables)

  Object.assign(variables, exampleMap)

  let effectiveLeadId = input.leadId?.trim() || null

  if (input.personalizationProfileId?.trim()) {
    const profile = await loadPersonalizationProfileScore(input.admin, input.personalizationProfileId.trim())
    if (profile) {
      sourcesUsed.push("personalization_profiles")
      if (!effectiveLeadId && profile.leadId) effectiveLeadId = profile.leadId
    }
  }

  if (effectiveLeadId) {
    const lead = await fetchGrowthLeadById(input.admin, effectiveLeadId)
    if (lead) {
      sourcesUsed.push("growth.leads")
      Object.assign(variables, buildVariablesFromLead(lead))
    }
  }

  if (input.companyCandidateId?.trim()) {
    const companyContext = await resolveCompanyCandidateContext(input.admin, input.companyCandidateId.trim())
    if (companyContext) {
      sourcesUsed.push("company_candidate")
      Object.assign(
        variables,
        normalizeVariableMap({
          "lead.company_name": companyContext.company_name,
          "lead.industry": companyContext.industry ?? "",
        }),
      )
      if (!effectiveLeadId && companyContext.growth_lead_id) {
        const lead = await fetchGrowthLeadById(input.admin, companyContext.growth_lead_id)
        if (lead) {
          sourcesUsed.push("growth.leads")
          Object.assign(variables, buildVariablesFromLead(lead))
        }
      }
    }
  }

  if (input.personCandidateId?.trim()) {
    const personVars = await loadPersonCandidate(input.admin, input.personCandidateId.trim())
    if (Object.keys(personVars).length) {
      sourcesUsed.push("person_candidate")
      Object.assign(variables, personVars)
    }
  }

  if (input.pageFields?.calendarUrl?.trim()) {
    variables["booking.link"] = input.pageFields.calendarUrl.trim()
  }
  if (input.pageFields?.ctaUrl?.trim()) {
    variables["lead.cta_url"] = input.pageFields.ctaUrl.trim()
  }

  const pageOverrides = {
    ...(input.pagePersonalization?.variables ?? {}),
    ...(input.pagePersonalization?.previewContext ?? {}),
  }
  if (Object.keys(pageOverrides).length) {
    sourcesUsed.push("video_pages.personalization_json")
    Object.assign(variables, normalizeVariableMap(pageOverrides))
  }

  const previewFormVars = buildPreviewFormVariables(input.previewForm)
  if (Object.keys(previewFormVars).length) {
    sourcesUsed.push("preview_form")
    Object.assign(variables, previewFormVars)
  }

  // Apply fallbacks for empty canonical keys.
  for (const [key, fallback] of Object.entries(fallbackMap)) {
    if (!variables[key]?.trim()) {
      variables[key] = fallback
    }
  }

  const aliases = buildGrowthVideoAliasResolutionReport(variables)
  const aliasMergeMap = buildGrowthVideoAliasMergeMap(variables)
  const fullMergeMap = { ...variables, ...aliasMergeMap }

  const requiredKeys = [
    ...Object.keys(pageOverrides),
    ...Object.keys(previewFormVars),
    "lead.contact_name",
    "lead.company_name",
    "lead.industry",
    "booking.link",
  ]
  const missing = detectMissingVariables(fullMergeMap, fallbackMap, requiredKeys)

  return {
    variables: fullMergeMap,
    aliases,
    missing,
    sourcesUsed: [...new Set(sourcesUsed)],
  }
}
