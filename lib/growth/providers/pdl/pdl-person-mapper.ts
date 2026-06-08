/** Map PDL person records → Equipify contact discovery raw contacts. Client-safe. */

import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import type { PdlPersonRecord } from "@/lib/growth/providers/pdl/pdl-types"

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

function pickEmail(person: PdlPersonRecord): string | null {
  const work = asTrimmedString(person.work_email)
  if (work) return work
  const recommended = asTrimmedString(person.recommended_personal_email)
  if (recommended) return recommended
  if (Array.isArray(person.emails)) {
    for (const entry of person.emails) {
      const address = asTrimmedString(entry?.address)
      if (address) return address
    }
  }
  return null
}

function pickPhone(person: PdlPersonRecord): string | null {
  const mobile = asTrimmedString(person.mobile_phone)
  if (mobile) return mobile
  if (Array.isArray(person.phone_numbers)) {
    for (const entry of person.phone_numbers) {
      const number = asTrimmedString(entry?.number)
      if (number) return number
    }
  }
  return null
}

function resolveConfidence(person: PdlPersonRecord): number {
  const likelihood = person.likelihood
  if (typeof likelihood === "number" && Number.isFinite(likelihood)) {
    if (likelihood <= 1) return Math.min(0.95, Math.max(0.35, likelihood))
    if (likelihood <= 10) return Math.min(0.95, Math.max(0.35, likelihood / 10))
  }
  const email = pickEmail(person)
  const phone = pickPhone(person)
  if (email && phone) return 0.82
  if (email || phone) return 0.72
  return 0.58
}

function locationLabel(person: PdlPersonRecord): string | null {
  const parts = [person.location_locality, person.location_region, person.location_country]
    .map((value) => asTrimmedString(value))
    .filter(Boolean)
  if (parts.length > 0) return parts.join(", ")
  return asTrimmedString(person.location_name)
}

export function mapPdlPersonToContactDiscoveryRaw(
  person: PdlPersonRecord,
  input: { company_name: string; domain: string | null; sandbox: boolean },
): GrowthContactDiscoveryProviderRawContact | null {
  const full_name = asTrimmedString(person.full_name)
  if (!full_name) return null

  const email = pickEmail(person)
  const phone = pickPhone(person)
  const linkedin_url = asTrimmedString(person.linkedin_url)
  const hasPii = Boolean(email || phone || linkedin_url)
  const location = locationLabel(person)
  const providerLabel = input.sandbox ? "People Data Labs (sandbox)" : "People Data Labs"

  const evidence = [
    {
      claim: "External people data provider match",
      evidence: `${providerLabel} person search match for ${input.domain ?? input.company_name}`,
      source: "people_data_labs",
    },
  ]

  const job_title = asTrimmedString(person.job_title)
  if (job_title) {
    evidence.push({
      claim: "Role attribution",
      evidence: job_title,
      source: "people_data_labs",
    })
  }

  return {
    full_name,
    first_name: asTrimmedString(person.first_name),
    last_name: asTrimmedString(person.last_name),
    job_title,
    department: asTrimmedString(person.job_title_sub_role),
    seniority: Array.isArray(person.job_title_levels)
      ? asTrimmedString(person.job_title_levels[0])
      : null,
    linkedin_url,
    email,
    phone,
    pii_observed: hasPii,
    confidence: resolveConfidence(person),
    evidence,
    source_attribution: [
      {
        source: "people_data_labs",
        provider_type: "future_people_data_labs",
        provider_name: "people_data_labs",
        signal: input.sandbox ? "pdl_sandbox_person_search" : "pdl_person_search",
        evidence: `${providerLabel} match for ${input.domain ?? input.company_name}`,
        confidence: resolveConfidence(person),
      },
    ],
    metadata: {
      pdl_person_id: person.id ?? null,
      pdl_sandbox: input.sandbox,
      pdl_company_website: person.job_company_website ?? input.domain,
      pdl_company_name: person.job_company_name ?? input.company_name,
      pdl_location: location,
      pdl_likelihood: person.likelihood ?? null,
      equipify_ranking_note: "Raw provider ordering ignored — Equipify contact-native ranking applies after merge.",
    },
  }
}

export function mapPdlPeopleToContactDiscoveryRaw(input: {
  people: PdlPersonRecord[]
  company_name: string
  domain: string | null
  sandbox: boolean
}): GrowthContactDiscoveryProviderRawContact[] {
  const seen = new Set<string>()
  const contacts: GrowthContactDiscoveryProviderRawContact[] = []

  const people = Array.isArray(input.people) ? input.people : []
  for (const person of people) {
    const mapped = mapPdlPersonToContactDiscoveryRaw(person, {
      company_name: input.company_name,
      domain: input.domain,
      sandbox: input.sandbox,
    })
    if (!mapped) continue
    const key = [
      mapped.full_name.toLowerCase(),
      (mapped.email ?? "").toLowerCase(),
      (mapped.job_title ?? "").toLowerCase(),
    ].join("|")
    if (seen.has(key)) continue
    seen.add(key)
    contacts.push(mapped)
  }

  return contacts
}
