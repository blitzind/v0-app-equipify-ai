import { createHash } from "node:crypto"
import type {
  GrowthNormalizedSignalDraft,
  GrowthSignalEvidenceDraft,
  GrowthSignalType,
} from "@/lib/growth/signals/signal-types"

function normalizeKeyPart(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function buildSignalEvidenceDedupeHash(
  signalId: string,
  entry: Pick<GrowthSignalEvidenceDraft, "source_type" | "source_url" | "excerpt" | "observed_at">,
): string {
  const key = [
    signalId,
    entry.source_type,
    normalizeKeyPart(entry.source_url),
    normalizeKeyPart(entry.excerpt).slice(0, 120),
    normalizeKeyPart(entry.observed_at),
  ].join("|")
  return createHash("sha256").update(key).digest("hex").slice(0, 40)
}

export function buildSignalDedupeHash(input: {
  organization_id?: string | null
  signal_type: GrowthSignalType
  provider_key: string
  provider_event_id?: string | null
  occurred_at: string
  company_name?: string | null
  domain?: string | null
  title?: string | null
  category?: string | null
}): string {
  const key = [
    normalizeKeyPart(input.organization_id) || "platform",
    input.signal_type,
    normalizeKeyPart(input.provider_key),
    normalizeKeyPart(input.provider_event_id),
    normalizeKeyPart(input.occurred_at).slice(0, 10),
    normalizeKeyPart(input.domain) || normalizeKeyPart(input.company_name),
    normalizeKeyPart(input.title),
    normalizeKeyPart(input.category),
  ].join("|")
  return createHash("sha256").update(key).digest("hex").slice(0, 40)
}

export const GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY = "hiring_velocity_derived" as const

function normalizeCompanyKey(domain: string | null | undefined, companyName: string | null | undefined): string {
  const domainKey = normalizeKeyPart(domain)
  if (domainKey) return `domain:${domainKey}`
  const nameKey = normalizeKeyPart(companyName)
  if (nameKey) return `company:${nameKey}`
  return "unknown"
}

export function buildDerivedHireDedupeHash(input: {
  organization_id?: string | null
  domain?: string | null
  company_name?: string | null
}): string {
  const companyKey = normalizeCompanyKey(input.domain, input.company_name)
  return buildSignalDedupeHash({
    organization_id: input.organization_id,
    signal_type: "hire",
    provider_key: GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY,
    provider_event_id: companyKey,
    occurred_at: "derived",
    domain: input.domain,
    company_name: input.company_name,
  })
}

export function attachSignalDedupeHash(draft: GrowthNormalizedSignalDraft): string {
  if (
    draft.signal_type === "hire" &&
    draft.provider_key === GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY
  ) {
    return buildDerivedHireDedupeHash({
      organization_id: draft.organization_id,
      domain: draft.domain,
      company_name: draft.company_name,
    })
  }

  return buildSignalDedupeHash({
    organization_id: draft.organization_id,
    signal_type: draft.signal_type,
    provider_key: draft.provider_key,
    provider_event_id: draft.provider_event_id,
    occurred_at: draft.occurred_at,
    company_name: draft.company_name,
    domain: draft.domain,
    title: draft.title,
    category: draft.category,
  })
}
