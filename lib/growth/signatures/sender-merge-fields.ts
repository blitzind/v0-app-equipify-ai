/**
 * Sender merge field substitution (GS-GROWTH-SIGNATURES-1B).
 * Client-safe — missing fields resolve to empty string; never throws.
 */

import type { GrowthSenderProfile } from "@/lib/growth/signatures/signature-types"

export const GROWTH_SENDER_MERGE_FIELD_KEYS = [
  "sender.name",
  "sender.first_name",
  "sender.last_name",
  "sender.title",
  "sender.email",
  "sender.phone",
  "sender.company",
  "sender.website",
] as const

export type GrowthSenderMergeFieldKey = (typeof GROWTH_SENDER_MERGE_FIELD_KEYS)[number]

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const trimmed = displayName.trim()
  if (!trimmed) return { firstName: "", lastName: "" }
  const parts = trimmed.split(/\s+/)
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") }
}

function companyFromProfile(profile: GrowthSenderProfile | null, website: string): string {
  const websiteTrimmed = website.trim()
  if (!websiteTrimmed) return ""
  try {
    const host = new URL(websiteTrimmed.includes("://") ? websiteTrimmed : `https://${websiteTrimmed}`).hostname
    return host.replace(/^www\./, "")
  } catch {
    return websiteTrimmed
  }
}

export function buildSenderMergeFields(
  profile: GrowthSenderProfile | null,
  senderEmail: string,
  senderDisplayName?: string | null,
): Record<string, string> {
  const displayName = profile?.display_name?.trim() || senderDisplayName?.trim() || ""
  const { firstName, lastName } = splitDisplayName(displayName)
  const email = profile?.email?.trim() || senderEmail.trim()
  const website = profile?.website?.trim() ?? ""

  return {
    "sender.name": displayName,
    "sender.first_name": firstName,
    "sender.last_name": lastName,
    "sender.title": profile?.title?.trim() ?? "",
    "sender.email": email,
    "sender.phone": profile?.phone?.trim() ?? "",
    "sender.company": companyFromProfile(profile, website),
    "sender.website": website,
    "sender.linkedin": profile?.linkedin_url?.trim() ?? "",
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Replaces `{{sender.name}}` style tokens. Unknown keys are left unchanged.
 */
export function applySenderMergeFieldsToText(text: string, mergeFields: Record<string, string>): string {
  if (!text) return text

  let rendered = text
  for (const key of GROWTH_SENDER_MERGE_FIELD_KEYS) {
    const value = mergeFields[key] ?? ""
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "gi")
    rendered = rendered.replace(pattern, value)
  }
  return rendered
}
