import { createHash } from "node:crypto"
import type { GrowthIntentAggregatedSession } from "@/lib/growth/lead-engine/intent/intent-session-aggregator"
import type { GrowthIntentLeadCandidateIdentity } from "@/lib/growth/lead-engine/intent/intent-candidate-types"

export type GrowthIntentDedupeSource = {
  email?: string | null
  phone?: string | null
  session_id?: string | null
  visitor_key?: string | null
  domain?: string | null
  company_name?: string | null
  existing_lead_ids?: string[]
  existing_customer_ids?: string[]
}

export type GrowthIntentDedupeResult = {
  dedupe_hash: string
  dedupe_matched: boolean
  dedupe_reason: string | null
  matched_on: string[]
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "")
}

function normalizeDomain(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^www\./, "")
}

export function buildIntentCandidateDedupeHash(sources: GrowthIntentDedupeSource): string {
  const parts = [
    `email:${normalizeEmail(sources.email)}`,
    `phone:${normalizePhone(sources.phone)}`,
    `session:${sources.session_id ?? ""}`,
    `visitor:${sources.visitor_key ?? ""}`,
    `domain:${normalizeDomain(sources.domain)}`,
    `company:${(sources.company_name ?? "").trim().toLowerCase()}`,
  ]
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)
}

export function checkIntentCandidateDedupe(
  sources: GrowthIntentDedupeSource,
  knownHashes: Set<string> = new Set(),
  crmIndex: {
    emails?: Set<string>
    phones?: Set<string>
    domains?: Set<string>
    session_ids?: Set<string>
  } = {},
): GrowthIntentDedupeResult {
  const dedupe_hash = buildIntentCandidateDedupeHash(sources)
  const matched_on: string[] = []

  if (knownHashes.has(dedupe_hash)) {
    matched_on.push("dedupe_hash")
  }

  const email = normalizeEmail(sources.email)
  if (email && crmIndex.emails?.has(email)) matched_on.push("email")

  const phone = normalizePhone(sources.phone)
  if (phone.length >= 7 && crmIndex.phones?.has(phone)) matched_on.push("phone")

  const sessionId = sources.session_id?.trim()
  if (sessionId && crmIndex.session_ids?.has(sessionId)) matched_on.push("intent_session")

  const domain = normalizeDomain(sources.domain)
  if (domain && crmIndex.domains?.has(domain)) matched_on.push("company_domain")

  if ((sources.existing_lead_ids?.length ?? 0) > 0) matched_on.push("existing_crm_lead")
  if ((sources.existing_customer_ids?.length ?? 0) > 0) matched_on.push("existing_crm_customer")

  const dedupe_matched = matched_on.length > 0
  const dedupe_reason = dedupe_matched
    ? `Duplicate detected on: ${matched_on.join(", ")}.`
    : null

  return {
    dedupe_hash,
    dedupe_matched,
    dedupe_reason,
    matched_on,
  }
}

export function buildDedupeSourcesFromAggregate(
  aggregated: GrowthIntentAggregatedSession,
  identity: GrowthIntentLeadCandidateIdentity,
  existingLeadIds: string[] = [],
  existingCustomerIds: string[] = [],
): GrowthIntentDedupeSource {
  return {
    email: identity.email,
    phone: identity.phone,
    session_id: aggregated.primary_session.id,
    visitor_key: aggregated.primary_session.visitor_key,
    domain: aggregated.domain,
    company_name: identity.company_name,
    existing_lead_ids: existingLeadIds,
    existing_customer_ids: existingCustomerIds,
  }
}
