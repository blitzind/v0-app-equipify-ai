/** Growth Engine B1 — Preview form merge rendering (client-safe). */

import { GROWTH_CONTENT_MERGE_FIELD_RE } from "@/lib/growth/content/merge-field-validator"
import { applySharePageTemplateMergeFields } from "@/lib/growth/share-pages/share-page-template-instantiation-compile"
import type {
  GrowthVideoPreviewFormInput,
  GrowthVideoRenderedPreview,
} from "@/lib/growth/videos/growth-video-types"
import {
  buildGrowthVideoAliasMergeMap,
  resolveGrowthVideoVariableAlias,
} from "@/lib/growth/videos/growth-video-variable-alias-service"

export function buildGrowthVideoPreviewFormMergeValues(
  form: GrowthVideoPreviewFormInput,
): Record<string, string> {
  const firstName = form.firstName?.trim() ?? ""
  const lastName = form.lastName?.trim() ?? ""
  const contactName = [firstName, lastName].filter(Boolean).join(" ")

  const canonical: Record<string, string> = {
    "lead.first_name": firstName,
    "lead.last_name": lastName,
    "lead.contact_name": contactName,
    "lead.company_name": form.company?.trim() ?? "",
    "lead.title": form.title?.trim() ?? "",
    "lead.industry": form.industry?.trim() ?? "",
    "lead.city": form.city?.trim() ?? "",
    "lead.state": form.state?.trim() ?? "",
    "lead.country": form.country?.trim() ?? "",
    "lead.email": form.email?.trim() ?? "",
    "lead.pain_point": form.painPoint?.trim() ?? "",
    "lead.cta_url": form.ctaUrl?.trim() ?? "",
    "sender.name": form.senderName?.trim() ?? "",
    "sender.email": form.senderEmail?.trim() ?? "",
    "booking.link": form.bookingLink?.trim() || form.calendarUrl?.trim() || "",
  }

  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(canonical)) {
    normalized[key.toLowerCase()] = value
  }

  return { ...normalized, ...buildGrowthVideoAliasMergeMap(normalized) }
}

export function renderGrowthVideoPreviewText(
  text: string,
  mergeValues: Record<string, string>,
): string {
  return applySharePageTemplateMergeFields(text, mergeValues)
}

export function extractGrowthVideoMissingTokens(
  text: string,
  mergeValues: Record<string, string>,
): string[] {
  const missing: string[] = []
  for (const match of text.matchAll(GROWTH_CONTENT_MERGE_FIELD_RE)) {
    const rawKey = match[1]?.trim().toLowerCase()
    if (!rawKey) continue
    const canonical = resolveGrowthVideoVariableAlias(rawKey)
    const value = mergeValues[rawKey] ?? mergeValues[canonical]
    if (!value?.trim()) {
      missing.push(canonical)
    }
  }
  return [...new Set(missing)]
}

export function renderGrowthVideoPreviewFields(input: {
  title: string
  description?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  calendarUrl?: string | null
  buttonLabelOverride?: string | null
  mergeValues: Record<string, string>
}): GrowthVideoRenderedPreview {
  return {
    title: renderGrowthVideoPreviewText(input.title, input.mergeValues),
    description: input.description
      ? renderGrowthVideoPreviewText(input.description, input.mergeValues)
      : null,
    ctaLabel: input.ctaLabel ? renderGrowthVideoPreviewText(input.ctaLabel, input.mergeValues) : null,
    ctaUrl: input.ctaUrl ? renderGrowthVideoPreviewText(input.ctaUrl, input.mergeValues) : null,
    calendarUrl: input.calendarUrl
      ? renderGrowthVideoPreviewText(input.calendarUrl, input.mergeValues)
      : null,
    buttonLabelOverride: input.buttonLabelOverride
      ? renderGrowthVideoPreviewText(input.buttonLabelOverride, input.mergeValues)
      : null,
  }
}
