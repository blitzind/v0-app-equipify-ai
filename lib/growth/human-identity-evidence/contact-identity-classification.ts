/** Phase 7.PS-HV — Contact/person identity classification. Client-safe. */

import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"

export const GROWTH_CONTACT_IDENTITY_CLASSIFICATION_QA_MARKER =
  "growth-contact-identity-classification-7-ps-hv-v1" as const

export type ContactIdentityClassification =
  | "named_person"
  | "role_contact"
  | "company_channel"
  | "generic_placeholder"

const ROLE_LABEL_PATTERNS = [
  /^customer\s+service$/i,
  /^sales(\s+team|\s+department)?$/i,
  /^support(\s+team)?$/i,
  /^service(\s+department|\s+team)?$/i,
  /^billing(\s+department)?$/i,
  /^dispatch$/i,
  /^reception$/i,
  /^main\s+office$/i,
  /^general(\s+inquiries?)?$/i,
  /^office(\s+staff)?$/i,
  /^front\s+desk$/i,
  /^call\s+center$/i,
  /^help\s+desk$/i,
  /^appointments?$/i,
  /^scheduling$/i,
  /^accounts?\s+receivable$/i,
  /^accounts?\s+payable$/i,
] as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isRoleLikeLabel(name: string): boolean {
  const normalized = name.trim()
  if (!normalized) return true
  if (isGenericIdentityName(normalized)) return true
  return ROLE_LABEL_PATTERNS.some((pattern) => pattern.test(normalized))
}

function looksLikePersonalName(name: string): boolean {
  const normalized = name.trim()
  if (!normalized || isRoleLikeLabel(normalized)) return false
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return false
  return tokens.every((token) => /^[A-Z][a-z'.-]+$/.test(token) || /^[A-Z]{2,}$/.test(token))
}

export function classifyContactIdentity(input: {
  full_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  source_type?: string | null
}): {
  classification: ContactIdentityClassification
  eligible_for_canonical_person: boolean
  eligible_for_committee: boolean
  reasons: string[]
} {
  const full_name = asString(input.full_name)
  const title = asString(input.title)
  const email = asString(input.email)
  const phone = asString(input.phone)
  const linkedin_url = asString(input.linkedin_url)
  const reasons: string[] = []

  const hasChannel = Boolean(email || phone || linkedin_url)
  const hasTitle = Boolean(title)

  if (looksLikePersonalName(full_name)) {
    reasons.push("personal_name_shape")
    return {
      classification: "named_person",
      eligible_for_canonical_person: true,
      eligible_for_committee: hasTitle,
      reasons,
    }
  }

  if (full_name && !isRoleLikeLabel(full_name)) {
    reasons.push("non_generic_full_name")
    return {
      classification: "named_person",
      eligible_for_canonical_person: true,
      eligible_for_committee: hasTitle,
      reasons,
    }
  }

  if (hasTitle && full_name && !isGenericIdentityName(full_name)) {
    reasons.push("role_contact_with_title")
    return {
      classification: "role_contact",
      eligible_for_canonical_person: true,
      eligible_for_committee: true,
      reasons,
    }
  }

  if (hasTitle && (full_name || hasChannel)) {
    reasons.push("titled_role_contact")
    return {
      classification: "role_contact",
      eligible_for_canonical_person: true,
      eligible_for_committee: true,
      reasons,
    }
  }

  if (hasChannel && (!full_name || isRoleLikeLabel(full_name))) {
    reasons.push("channel_without_named_human")
    return {
      classification: "company_channel",
      eligible_for_canonical_person: false,
      eligible_for_committee: false,
      reasons,
    }
  }

  reasons.push("generic_placeholder")
  return {
    classification: "generic_placeholder",
    eligible_for_canonical_person: false,
    eligible_for_committee: false,
    reasons,
  }
}

export function shouldMaterializeCanonicalPerson(input: {
  full_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
}): boolean {
  return classifyContactIdentity(input).eligible_for_canonical_person
}

export function countsTowardNamedPersonDensity(classification: ContactIdentityClassification): boolean {
  return classification === "named_person"
}

export function countsTowardPersonTotal(classification: ContactIdentityClassification): boolean {
  return classification === "named_person" || classification === "role_contact"
}
