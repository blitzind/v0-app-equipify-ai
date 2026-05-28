/** Map PDL person records → Equipify contact discovery raw contacts. Client-safe. */

import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import type { PdlPersonRecord } from "@/lib/growth/providers/pdl/pdl-types"

function pickEmail(person: PdlPersonRecord): string | null {
  const work = person.work_email?.trim()
  if (work) return work
  const recommended = person.recommended_personal_email?.trim()
  if (recommended) return recommended
  for (const entry of person.emails ?? []) {
    const address = entry.address?.trim()
    if (address) return address
  }
  return null
}

function pickPhone(person: PdlPersonRecord): string | null {
  const mobile = person.mobile_phone?.trim()
  if (mobile) return mobile
  for (const entry of person.phone_numbers ?? []) {
    const number = entry.number?.trim()
    if (number) return number
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
    .map((value) => value?.trim())
    .filter(Boolean)
  if (parts.length > 0) return parts.join(", ")
  return person.location_name?.trim() || null
}

export function mapPdlPersonToContactDiscoveryRaw(
  person: PdlPersonRecord,
  input: { company_name: string; domain: string | null; sandbox: boolean },
): GrowthContactDiscoveryProviderRawContact | null {
  const full_name = person.full_name?.trim()
  if (!full_name) return null

  const email = pickEmail(person)
  const phone = pickPhone(person)
  const linkedin_url = person.linkedin_url?.trim() || null
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

  if (person.job_title?.trim()) {
    evidence.push({
      claim: "Role attribution",
      evidence: person.job_title.trim(),
      source: "people_data_labs",
    })
  }

  return {
    full_name,
    first_name: person.first_name?.trim() || null,
    last_name: person.last_name?.trim() || null,
    job_title: person.job_title?.trim() || null,
    department: person.job_title_sub_role?.trim() || null,
    seniority: person.job_title_levels?.[0]?.trim() || null,
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

  for (const person of input.people) {
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
