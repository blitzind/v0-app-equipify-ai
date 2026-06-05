/** Phase 7.PS-IB — Batch expansion density funnel metrics. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import type { BatchGraphExpansionDensityFunnel } from "@/lib/growth/graph-expansion/batch-graph-expansion-types"
import { countOutreachReadyCompanies } from "@/lib/growth/graph-expansion/person-committee-density-expansion"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function loadBatchGraphExpansionDensityFunnel(
  admin: SupabaseClient,
  company_ids: string[],
): Promise<BatchGraphExpansionDensityFunnel> {
  if (company_ids.length === 0) {
    return {
      companies: 0,
      companies_with_contacts: 0,
      named_person_companies: 0,
      verified_channel_companies: 0,
      outreach_ready_companies: 0,
      total_named_persons: 0,
      total_verified_emails: 0,
      total_verified_phones: 0,
      generic_identities: 0,
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
  let generic_identities = 0
  let total_named_persons = 0

  for (const row of contacts ?? []) {
    const company_id = asString((row as Record<string, unknown>).company_id)
    if (!byCompany.has(company_id)) byCompany.set(company_id, [])
    byCompany.get(company_id)!.push(row as Record<string, unknown>)

    const full_name = asString((row as Record<string, unknown>).full_name)
    if (isGenericIdentityName(full_name)) generic_identities += 1
    const identity = classifyContactIdentity({
      full_name,
      title: asString((row as Record<string, unknown>).title),
      email: asString((row as Record<string, unknown>).email),
      phone: asString((row as Record<string, unknown>).phone),
      linkedin_url: asString((row as Record<string, unknown>).linkedin_url),
      source_type: asString((row as Record<string, unknown>).source_type),
    })
    if (identity.classification === "named_person") total_named_persons += 1
  }

  const personIds = [
    ...new Set(
      (contacts ?? [])
        .map((row) => asString((row as Record<string, unknown>).canonical_person_id))
        .filter(Boolean),
    ),
  ]

  const verifiedEmailByPerson = new Map<string, number>()
  const verifiedPhoneByPerson = new Map<string, number>()
  if (personIds.length > 0) {
    const [{ data: emails }, { data: phones }] = await Promise.all([
      admin
        .schema("growth")
        .from("person_emails")
        .select("person_id")
        .in("person_id", personIds)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_phones")
        .select("person_id")
        .in("person_id", personIds)
        .eq("verification_status", "verified"),
    ])
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
  let named_person_companies = 0
  let verified_channel_companies = 0
  let total_verified_emails = 0
  let total_verified_phones = 0

  for (const company_id of company_ids) {
    const rows = byCompany.get(company_id) ?? []
    if (rows.length > 0) companies_with_contacts += 1

    let hasNamed = false
    let hasVerified = false
    const namedPersonIds = new Set<string>()

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
      const pid = asString(row.canonical_person_id)
      if (pid) namedPersonIds.add(pid)
    }

    for (const pid of namedPersonIds) {
      const emails = verifiedEmailByPerson.get(pid) ?? 0
      const phones = verifiedPhoneByPerson.get(pid) ?? 0
      total_verified_emails += emails
      total_verified_phones += phones
      if (emails > 0 || phones > 0) hasVerified = true
    }

    if (hasNamed) named_person_companies += 1
    if (hasVerified) verified_channel_companies += 1
  }

  const outreach_ready_companies = await countOutreachReadyCompanies(admin, company_ids)

  return {
    companies: company_ids.length,
    companies_with_contacts,
    named_person_companies,
    verified_channel_companies,
    outreach_ready_companies,
    total_named_persons,
    total_verified_emails,
    total_verified_phones,
    generic_identities,
  }
}
