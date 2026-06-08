/** Map Apollo people → Equipify contact discovery raw contacts. Client-safe. */

import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { isPlausiblePersonName } from "@/lib/growth/contact-discovery/extract/extract-shared"
import { GROWTH_CONTACT_ACQUISITION_PROVIDER_ADAPTER_QA_MARKER } from "@/lib/growth/contact-discovery/contact-acquisition-provider-adapter-types"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import { isFalsePositiveEmailLocalPartIdentity } from "@/lib/growth/human-identity-evidence/email-local-part-identity-guards"
import { isApolloIrrelevantTitleForIcp } from "@/lib/growth/providers/apollo/apollo-title-buckets"
import type { ApolloPersonRecord, ApolloSearchDiagnostics } from "@/lib/growth/providers/apollo/apollo-types"

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function resolveFullName(person: ApolloPersonRecord): string | null {
  const name = asTrimmedString(person.name)
  if (name) return name
  const first = asTrimmedString(person.first_name)
  const last = asTrimmedString(person.last_name)
  if (first && last) return `${first} ${last}`
  return first ?? last
}

function pickPhone(person: ApolloPersonRecord): string | null {
  const direct = asTrimmedString(person.sanitized_phone)
  if (direct) return direct
  if (Array.isArray(person.phone_numbers)) {
    for (const entry of person.phone_numbers) {
      const number = asTrimmedString(entry?.sanitized_number) ?? asTrimmedString(entry?.raw_number)
      if (number) return number
    }
  }
  return null
}

function pickLinkedIn(person: ApolloPersonRecord): string | null {
  const url = asTrimmedString(person.linkedin_url)
  if (!url) return null
  return /linkedin\.com/i.test(url) ? url : null
}

function isObservedEmail(person: ApolloPersonRecord, email: string | null): boolean {
  if (!email) return false
  const status = asTrimmedString(person.email_status)?.toLowerCase() ?? ""
  if (status === "unavailable" || status === "invalid") return false
  if (person.extrapolated_email_confidence != null && person.extrapolated_email_confidence <= 0) {
    return false
  }
  if (status === "guessed" || status === "extrapolated") return false
  return Boolean(asTrimmedString(person.email))
}

function resolveConfidence(person: ApolloPersonRecord, hasPii: boolean): number {
  const status = asTrimmedString(person.email_status)?.toLowerCase() ?? ""
  if (status === "verified") return 0.85
  if (hasPii) return 0.72
  if (asTrimmedString(person.title)) return 0.58
  return 0.5
}

export function evaluateApolloContactAcceptance(
  person: ApolloPersonRecord,
  mapped: GrowthContactDiscoveryProviderRawContact | null,
): { accepted: boolean; reason: string | null } {
  if (!mapped) return { accepted: false, reason: "map_failed" }

  const full_name = mapped.full_name
  if (!full_name || full_name.length < 2) return { accepted: false, reason: "missing_full_name" }
  if (!isPlausiblePersonName(full_name)) return { accepted: false, reason: "name_not_plausible" }
  if (isFalsePositiveEmailLocalPartIdentity(full_name, mapped.email)) {
    return { accepted: false, reason: "false_positive_email_local_part_identity" }
  }

  const identity = classifyContactIdentity({
    full_name,
    title: mapped.job_title,
    email: mapped.email,
    phone: mapped.phone,
    linkedin_url: mapped.linkedin_url,
    source_type: "public_record",
  })

  if (!identity.eligible_for_canonical_person) {
    return { accepted: false, reason: `identity_${identity.classification}` }
  }
  if (identity.classification === "company_channel" || identity.classification === "generic_placeholder") {
    return { accepted: false, reason: "company_channel_or_generic" }
  }

  return { accepted: true, reason: null }
}

export function mapApolloPersonToContactDiscoveryRaw(
  person: ApolloPersonRecord,
  input: { company_name: string; domain: string | null; mock: boolean },
): GrowthContactDiscoveryProviderRawContact | null {
  const full_name = resolveFullName(person)
  if (!full_name) return null

  const rawEmail = asTrimmedString(person.email)
  const email = isObservedEmail(person, rawEmail) ? rawEmail : null
  const phone = pickPhone(person)
  const linkedin_url = pickLinkedIn(person)
  const hasPii = Boolean(email || phone || linkedin_url)

  const job_title = asTrimmedString(person.title) ?? asTrimmedString(person.headline)
  const org = person.organization
  const sourceUrl =
    asTrimmedString(org?.linkedin_url) ??
    asTrimmedString(org?.website_url) ??
    (input.domain ? `https://${input.domain}` : null)

  const providerLabel = input.mock ? "Apollo (mock)" : "Apollo"
  const evidence = [
    {
      claim: "External people data provider match",
      evidence: `${providerLabel} people search for ${input.domain ?? input.company_name}`,
      source: "apollo",
      page_url: sourceUrl,
    },
  ]
  if (job_title) {
    evidence.push({
      claim: "Role attribution",
      evidence: job_title,
      source: "apollo",
      page_url: sourceUrl,
    })
  }

  const confidence = resolveConfidence(person, hasPii)

  return {
    full_name,
    first_name: asTrimmedString(person.first_name),
    last_name: asTrimmedString(person.last_name),
    job_title,
    department: Array.isArray(person.departments) ? asTrimmedString(person.departments[0]) : null,
    seniority: asTrimmedString(person.seniority),
    linkedin_url,
    email,
    phone,
    pii_observed: hasPii,
    confidence,
    external_provider_contact_id: asTrimmedString(person.id),
    evidence,
    source_attribution: [
      {
        source: "apollo",
        provider_type: "future_apollo",
        provider_name: "apollo",
        signal: input.mock ? "apollo_mock_person_search" : "apollo_person_search",
        evidence: `${providerLabel} match for ${input.domain ?? input.company_name}`,
        confidence,
      },
    ],
    metadata: {
      qa_marker: GROWTH_CONTACT_ACQUISITION_PROVIDER_ADAPTER_QA_MARKER,
      provider: "apollo",
      apollo_person_id: asTrimmedString(person.id),
      apollo_organization_id:
        asTrimmedString(person.organization_id) ?? asTrimmedString(org?.id),
      apollo_email_status: asTrimmedString(person.email_status),
      apollo_seniority: asTrimmedString(person.seniority),
      apollo_departments: person.departments ?? [],
      apollo_functions: person.functions ?? [],
      apollo_raw_title: asTrimmedString(person.title),
      apollo_mock: input.mock,
      apollo_source_url: sourceUrl,
      apollo_has_email_flag: person.has_email === true,
      apollo_has_direct_phone_flag: person.has_direct_phone === true,
      equipify_ranking_note:
        "Raw Apollo ordering ignored — Equipify contact-native ranking applies after merge.",
    },
  }
}

export function mapApolloPeopleToContactDiscoveryRaw(input: {
  people: ApolloPersonRecord[]
  company_name: string
  domain: string | null
  mock: boolean
}): {
  contacts: GrowthContactDiscoveryProviderRawContact[]
  diagnostics: Pick<ApolloSearchDiagnostics, "contacts_mapped" | "contacts_skipped" | "skip_reasons">
} {
  const skip_reasons: Record<string, number> = {}
  const seen = new Set<string>()
  const contacts: GrowthContactDiscoveryProviderRawContact[] = []

  for (const person of input.people) {
    const rawTitle = asTrimmedString(person.title) ?? asTrimmedString(person.headline)
    if (isApolloIrrelevantTitleForIcp(rawTitle)) {
      skip_reasons.irrelevant_title = (skip_reasons.irrelevant_title ?? 0) + 1
      continue
    }

    const mapped = mapApolloPersonToContactDiscoveryRaw(person, {
      company_name: input.company_name,
      domain: input.domain,
      mock: input.mock,
    })
    const gate = evaluateApolloContactAcceptance(person, mapped)
    if (!gate.accepted || !mapped) {
      const reason = gate.reason ?? "rejected"
      skip_reasons[reason] = (skip_reasons[reason] ?? 0) + 1
      continue
    }

    const key = [
      mapped.full_name.toLowerCase(),
      (mapped.email ?? "").toLowerCase(),
      (mapped.job_title ?? "").toLowerCase(),
    ].join("|")
    if (seen.has(key)) {
      skip_reasons.duplicate = (skip_reasons.duplicate ?? 0) + 1
      continue
    }
    seen.add(key)
    contacts.push(mapped)
  }

  return {
    contacts,
    diagnostics: {
      contacts_mapped: contacts.length,
      contacts_skipped: input.people.length - contacts.length,
      skip_reasons,
    },
  }
}
