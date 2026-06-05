/** Phase 7.PS-IJ — Apollo replacement benchmark metrics loader. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import { countOutreachReadyCompanies } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import type { ApolloReplacementBenchmarkMetrics } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function density(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 1000
}

export async function loadApolloReplacementBenchmarkMetrics(
  admin: SupabaseClient,
  company_ids: string[],
): Promise<ApolloReplacementBenchmarkMetrics> {
  const total_companies = company_ids.length
  if (total_companies === 0) {
    return {
      company: {
        total_companies: 0,
        companies_with_contacts: 0,
        companies_with_named_persons: 0,
        companies_with_titled_persons: 0,
        outreach_ready_companies: 0,
        sequence_ready_companies: 0,
      },
      person: {
        total_persons: 0,
        named_persons: 0,
        titled_persons: 0,
        committee_members: 0,
      },
      channel: {
        verified_emails: 0,
        verified_phones: 0,
        verified_social_profiles: 0,
      },
      quality: {
        named_person_density: 0,
        title_density: 0,
        committee_density: 0,
        outreach_ready_density: 0,
        sequence_ready_density: 0,
      },
    }
  }

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "company_id, canonical_person_id, full_name, title, email, phone, linkedin_url, source_type",
    )
    .in("company_id", company_ids)
    .neq("contact_status", "archived")

  const byCompany = new Map<string, Array<Record<string, unknown>>>()
  const personIds = new Set<string>()
  let named_persons = 0
  let titled_persons = 0

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const company_id = asString(record.company_id)
    if (!byCompany.has(company_id)) byCompany.set(company_id, [])
    byCompany.get(company_id)!.push(record)

    const full_name = asString(record.full_name)
    const title = asString(record.title)
    const identity = classifyContactIdentity({
      full_name,
      title,
      email: asString(record.email),
      phone: asString(record.phone),
      linkedin_url: asString(record.linkedin_url),
      source_type: asString(record.source_type),
    })
    if (identity.classification === "named_person") named_persons += 1
    if (title) titled_persons += 1

    const person_id = asString(record.canonical_person_id)
    if (person_id) personIds.add(person_id)
  }

  const { data: roles } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("person_id, title, company_id")
    .in("company_id", company_ids)

  for (const row of roles ?? []) {
    const person_id = asString((row as Record<string, unknown>).person_id)
    const title = asString((row as Record<string, unknown>).title)
    if (person_id) personIds.add(person_id)
    if (title) titled_persons += 1
  }

  const { data: persons } =
    personIds.size > 0
      ? await admin
          .schema("growth")
          .from("persons")
          .select("id, full_name")
          .in("id", [...personIds])
      : { data: [] }

  for (const row of persons ?? []) {
    const name = asString((row as Record<string, unknown>).full_name)
    if (name && !isGenericIdentityName(name)) named_persons += 1
  }

  let verified_emails = 0
  let verified_phones = 0
  let verified_social_profiles = 0
  const verifiedEmailByPerson = new Map<string, number>()
  const verifiedPhoneByPerson = new Map<string, number>()

  if (personIds.size > 0) {
    const ids = [...personIds]
    const [{ data: emails }, { data: phones }, { data: profiles }] = await Promise.all([
      admin
        .schema("growth")
        .from("person_emails")
        .select("person_id")
        .in("person_id", ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_phones")
        .select("person_id")
        .in("person_id", ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_profiles")
        .select("person_id")
        .in("person_id", ids)
        .eq("verification_status", "verified"),
    ])

    verified_emails = emails?.length ?? 0
    verified_phones = phones?.length ?? 0
    verified_social_profiles = profiles?.length ?? 0

    for (const row of emails ?? []) {
      const pid = asString(row.person_id)
      verifiedEmailByPerson.set(pid, (verifiedEmailByPerson.get(pid) ?? 0) + 1)
    }
    for (const row of phones ?? []) {
      const pid = asString(row.person_id)
      verifiedPhoneByPerson.set(pid, (verifiedPhoneByPerson.get(pid) ?? 0) + 1)
    }
  }

  let companies_with_contacts = 0
  let companies_with_named_persons = 0
  let companies_with_titled_persons = 0
  let sequence_ready_companies = 0

  for (const company_id of company_ids) {
    const rows = byCompany.get(company_id) ?? []
    if (rows.length > 0) companies_with_contacts += 1

    let hasNamed = false
    let hasTitle = false
    let hasVerifiedEmail = false
    const companyPersonIds = new Set<string>()

    for (const row of rows) {
      const identity = classifyContactIdentity({
        full_name: asString(row.full_name),
        title: asString(row.title),
        email: asString(row.email),
        phone: asString(row.phone),
        linkedin_url: asString(row.linkedin_url),
        source_type: asString(row.source_type),
      })
      if (identity.classification === "named_person") hasNamed = true
      if (asString(row.title)) hasTitle = true
      const pid = asString(row.canonical_person_id)
      if (pid) companyPersonIds.add(pid)
    }

    for (const pid of companyPersonIds) {
      if ((verifiedEmailByPerson.get(pid) ?? 0) > 0) hasVerifiedEmail = true
    }

    if (hasNamed) companies_with_named_persons += 1
    if (hasTitle) companies_with_titled_persons += 1
    if (hasNamed && hasVerifiedEmail) sequence_ready_companies += 1
  }

  const outreach_ready_companies = await countOutreachReadyCompanies(admin, company_ids)

  const { count: committeeCount } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("id", { count: "exact", head: true })
    .in("company_id", company_ids)

  const committee_members = committeeCount ?? 0
  const total_persons = personIds.size

  return {
    company: {
      total_companies,
      companies_with_contacts,
      companies_with_named_persons,
      companies_with_titled_persons,
      outreach_ready_companies,
      sequence_ready_companies,
    },
    person: {
      total_persons,
      named_persons,
      titled_persons,
      committee_members,
    },
    channel: {
      verified_emails,
      verified_phones,
      verified_social_profiles,
    },
    quality: {
      named_person_density: density(named_persons, total_companies),
      title_density: density(titled_persons, total_companies),
      committee_density: density(committee_members, total_companies),
      outreach_ready_density: density(outreach_ready_companies, total_companies),
      sequence_ready_density: density(sequence_ready_companies, total_companies),
    },
  }
}
