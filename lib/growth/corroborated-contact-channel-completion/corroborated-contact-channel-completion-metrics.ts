/** Phase 7.PS-HZ — Outreach and verified channel metrics for corroborated persons. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { countOutreachReadyCompanies } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function countVerifiedChannelsForPerson(
  admin: SupabaseClient,
  person_id: string,
): Promise<number> {
  const [{ count: emailCount }, { count: phoneCount }, { count: profileCount }] = await Promise.all([
    admin
      .schema("growth")
      .from("person_emails")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person_id)
      .eq("verification_status", "verified"),
    admin
      .schema("growth")
      .from("person_phones")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person_id)
      .eq("verification_status", "verified"),
    admin
      .schema("growth")
      .from("person_profiles")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person_id)
      .eq("verification_status", "verified"),
  ])
  return (emailCount ?? 0) + (phoneCount ?? 0) + (profileCount ?? 0)
}

export async function personHasVerifiedReachableChannel(
  admin: SupabaseClient,
  person_id: string,
): Promise<boolean> {
  const [{ count: emailCount }, { count: phoneCount }] = await Promise.all([
    admin
      .schema("growth")
      .from("person_emails")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person_id)
      .eq("verification_status", "verified"),
    admin
      .schema("growth")
      .from("person_phones")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person_id)
      .eq("verification_status", "verified"),
  ])
  return (emailCount ?? 0) > 0 || (phoneCount ?? 0) > 0
}

export async function countOutreachReadyContactsForPersons(
  admin: SupabaseClient,
  person_ids: string[],
): Promise<number> {
  if (person_ids.length === 0) return 0

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("canonical_person_id, full_name, title, email, phone, linkedin_url")
    .in("canonical_person_id", person_ids)
    .neq("contact_status", "archived")

  let ready = 0
  const seen = new Set<string>()

  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const person_id = asString(record.canonical_person_id)
    if (!person_id || seen.has(person_id)) continue

    const identity = classifyContactIdentity({
      full_name: asString(record.full_name),
      title: asString(record.title),
      email: asString(record.email),
      phone: asString(record.phone),
      linkedin_url: asString(record.linkedin_url),
    })
    if (!identity.eligible_for_canonical_person) continue

    const reachable = await personHasVerifiedReachableChannel(admin, person_id)
    if (reachable) {
      ready += 1
      seen.add(person_id)
    }
  }

  return ready
}

export async function loadOutreachReadinessSnapshot(
  admin: SupabaseClient,
  input: { person_ids: string[]; company_ids: string[] },
): Promise<{
  outreach_ready_contacts: number
  outreach_ready_companies: number
  verified_emails: number
  verified_phones: number
  verified_profiles: number
}> {
  let verified_emails = 0
  let verified_phones = 0
  let verified_profiles = 0

  if (input.person_ids.length > 0) {
    const [{ count: emailCount }, { count: phoneCount }, { count: profileCount }] = await Promise.all([
      admin
        .schema("growth")
        .from("person_emails")
        .select("id", { count: "exact", head: true })
        .in("person_id", input.person_ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_phones")
        .select("id", { count: "exact", head: true })
        .in("person_id", input.person_ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_profiles")
        .select("id", { count: "exact", head: true })
        .in("person_id", input.person_ids)
        .eq("verification_status", "verified"),
    ])
    verified_emails = emailCount ?? 0
    verified_phones = phoneCount ?? 0
    verified_profiles = profileCount ?? 0
  }

  const outreach_ready_contacts = await countOutreachReadyContactsForPersons(admin, input.person_ids)
  const outreach_ready_companies = await countOutreachReadyCompanies(admin, input.company_ids)

  return {
    outreach_ready_contacts,
    outreach_ready_companies,
    verified_emails,
    verified_phones,
    verified_profiles,
  }
}
