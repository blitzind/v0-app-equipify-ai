/**
 * Canonical person DB helpers (CLI + server safe — no `server-only`).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  canonicalDisplayPersonName,
  canonicalNormalizedPersonEmail,
  canonicalNormalizedPersonLinkedIn,
  canonicalNormalizedPersonName,
  canonicalNormalizedPersonPhone,
  splitPersonName,
} from "@/lib/growth/canonical-persons/canonical-person-normalize"
import { resolutionConfidenceFromPersonMethod } from "@/lib/growth/canonical-persons/canonical-person-resolver"
import type {
  GrowthCanonicalPersonCandidateInput,
  GrowthCanonicalPersonResolutionMethod,
  GrowthCanonicalPersonResolutionResult,
} from "@/lib/growth/canonical-persons/canonical-person-types"

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export type InsertCanonicalPersonPayload = {
  first_name: string | null
  last_name: string | null
  full_name: string
  normalized_name: string
  primary_title: string | null
  primary_department: string | null
  primary_seniority: string | null
  location: string | null
  confidence: number
  resolution_method: GrowthCanonicalPersonResolutionMethod
  last_seen_at: string
  metadata: Record<string, unknown>
}

export function buildCanonicalPersonInsertPayload(
  input: GrowthCanonicalPersonCandidateInput,
  method: GrowthCanonicalPersonResolutionMethod,
): InsertCanonicalPersonPayload {
  const now = new Date().toISOString()
  const split = splitPersonName(input.full_name)
  return {
    first_name: input.first_name ?? split.first_name,
    last_name: input.last_name ?? split.last_name,
    full_name: canonicalDisplayPersonName(input),
    normalized_name: canonicalNormalizedPersonName(input.full_name),
    primary_title: input.title ?? null,
    primary_department: input.department ?? null,
    primary_seniority: input.seniority ?? null,
    location: input.location ?? null,
    confidence: resolutionConfidenceFromPersonMethod(method, input.confidence),
    resolution_method: method,
    last_seen_at: input.observed_at ?? now,
    metadata: {
      qa_marker: "growth-canonical-person-7.2b-v1",
      first_source_table: input.source_table,
      first_source_id: input.source_id,
    },
  }
}

export async function insertCanonicalPerson(
  admin: SupabaseClient,
  payload: InsertCanonicalPersonPayload,
): Promise<string> {
  const { data, error } = await admin
    .schema("growth")
    .from("persons")
    .insert(payload)
    .select("id")
    .single()
  if (error) throw new Error(`insertCanonicalPerson: ${error.message}`)
  return asString(data?.id)
}

export async function touchCanonicalPersonSeen(
  admin: SupabaseClient,
  personId: string,
  observedAt: string,
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("persons")
    .update({ last_seen_at: observedAt })
    .eq("id", personId)
  if (error) throw new Error(`touchCanonicalPersonSeen: ${error.message}`)
}

export async function upsertCanonicalPersonEmail(
  admin: SupabaseClient,
  input: {
    person_id: string
    email: string
    normalized_email: string
    email_type: string
    is_primary: boolean
    verification_status: string
    confidence: number
    source_table: string
    source_id: string
    provider_name: string
    discovery_source: string
    observed_at: string
    metadata: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("person_emails").upsert(
    {
      person_id: input.person_id,
      email: input.email,
      normalized_email: input.normalized_email,
      email_type: input.email_type,
      is_primary: input.is_primary,
      verification_status: input.verification_status,
      confidence: input.confidence,
      source_table: input.source_table,
      source_id: input.source_id,
      provider_name: input.provider_name,
      discovery_source: input.discovery_source,
      observed_at: input.observed_at,
      metadata: input.metadata,
    },
    { onConflict: "normalized_email", ignoreDuplicates: false },
  )
  if (error) throw new Error(`upsertCanonicalPersonEmail: ${error.message}`)
}

export async function upsertCanonicalPersonPhone(
  admin: SupabaseClient,
  input: {
    person_id: string
    phone: string
    normalized_phone: string
    phone_type: string
    is_primary: boolean
    verification_status: string
    confidence: number
    source_table: string
    source_id: string
    provider_name: string
    discovery_source: string
    observed_at: string
    metadata: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("person_phones").upsert(
    {
      person_id: input.person_id,
      phone: input.phone,
      normalized_phone: input.normalized_phone,
      phone_type: input.phone_type,
      is_primary: input.is_primary,
      verification_status: input.verification_status,
      confidence: input.confidence,
      source_table: input.source_table,
      source_id: input.source_id,
      provider_name: input.provider_name,
      discovery_source: input.discovery_source,
      observed_at: input.observed_at,
      metadata: input.metadata,
    },
    { onConflict: "normalized_phone", ignoreDuplicates: false },
  )
  if (error) throw new Error(`upsertCanonicalPersonPhone: ${error.message}`)
}

export async function upsertCanonicalPersonProfile(
  admin: SupabaseClient,
  input: {
    person_id: string
    profile_type: string
    profile_url: string
    normalized_profile_key: string
    confidence: number
    source_table: string
    source_id: string
    provider_name: string
    discovery_source: string
    observed_at: string
    metadata: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("person_profiles").upsert(
    {
      person_id: input.person_id,
      profile_type: input.profile_type,
      profile_url: input.profile_url,
      normalized_profile_key: input.normalized_profile_key,
      confidence: input.confidence,
      source_table: input.source_table,
      source_id: input.source_id,
      provider_name: input.provider_name,
      discovery_source: input.discovery_source,
      observed_at: input.observed_at,
      metadata: input.metadata,
    },
    { onConflict: "normalized_profile_key", ignoreDuplicates: false },
  )
  if (error) throw new Error(`upsertCanonicalPersonProfile: ${error.message}`)
}

export async function upsertCanonicalPersonCompanyRole(
  admin: SupabaseClient,
  input: {
    person_id: string
    company_id: string
    title: string | null
    department: string | null
    seniority: string | null
    role_type: string
    is_primary: boolean
    confidence: number
    source_table: string
    source_id: string
    provider_name: string
    discovery_source: string
    observed_at: string
    metadata: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("person_company_roles").upsert(
    {
      person_id: input.person_id,
      company_id: input.company_id,
      title: input.title ?? "",
      department: input.department,
      seniority: input.seniority,
      role_type: input.role_type,
      is_primary: input.is_primary,
      confidence: input.confidence,
      source_table: input.source_table,
      source_id: input.source_id,
      provider_name: input.provider_name,
      discovery_source: input.discovery_source,
      observed_at: input.observed_at,
      metadata: input.metadata,
    },
    { onConflict: "person_id,company_id,title", ignoreDuplicates: false },
  )
  if (error) throw new Error(`upsertCanonicalPersonCompanyRole: ${error.message}`)
}

export async function upsertCanonicalPersonLineage(
  admin: SupabaseClient,
  input: {
    person_id: string
    source_table: string
    source_id: string
    provider_name: string
    discovery_source: string
    confidence: number
    observed_at: string
    metadata: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.schema("growth").from("person_source_lineage").upsert(
    {
      person_id: input.person_id,
      source_table: input.source_table,
      source_id: input.source_id,
      provider_name: input.provider_name,
      discovery_source: input.discovery_source,
      confidence: input.confidence,
      observed_at: input.observed_at,
      metadata: input.metadata,
    },
    { onConflict: "source_table,source_id", ignoreDuplicates: false },
  )
  if (error) throw new Error(`upsertCanonicalPersonLineage: ${error.message}`)
}

export async function updateStagingCanonicalPersonId(
  admin: SupabaseClient,
  sourceTable: GrowthCanonicalPersonCandidateInput["source_table"],
  sourceId: string,
  canonicalPersonId: string,
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from(sourceTable)
    .update({ canonical_person_id: canonicalPersonId })
    .eq("id", sourceId)
  if (error) throw new Error(`updateStagingCanonicalPersonId(${sourceTable}): ${error.message}`)
}

export async function fetchLineagePersonId(
  admin: SupabaseClient,
  sourceTable: string,
  sourceId: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("person_source_lineage")
    .select("person_id")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .maybeSingle()
  return data?.person_id ? asString(data.person_id) : null
}

export async function fetchStagingCanonicalCompanyId(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<string | null> {
  for (const table of ["external_company_candidates", "real_world_company_candidates"] as const) {
    const { data } = await admin
      .schema("growth")
      .from(table)
      .select("canonical_company_id")
      .eq("id", companyCandidateId)
      .maybeSingle()
    const id = asString(data?.canonical_company_id)
    if (id) return id
  }
  return null
}

export async function resolveCanonicalCompanyIdForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("website, metadata")
    .eq("id", leadId)
    .maybeSingle()
  if (error || !data) return null

  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {}
  const direct = asString(metadata.canonical_company_id)
  if (direct) return direct

  const candidateId =
    asString(metadata.company_candidate_id) ||
    asString(metadata.external_company_candidate_id) ||
    asString(metadata.real_world_company_candidate_id)
  if (candidateId) {
    const fromCandidate = await fetchStagingCanonicalCompanyId(admin, candidateId)
    if (fromCandidate) return fromCandidate
  }

  const domain = canonicalNormalizedDomain(null, asString(data.website))
  if (!domain) return null

  const { data: company } = await admin
    .schema("growth")
    .from("companies")
    .select("id")
    .eq("primary_domain", domain)
    .eq("status", "active")
    .maybeSingle()
  return company?.id ? asString(company.id) : null
}

export async function resolveCanonicalCompanyIdForCompanyContact(
  admin: SupabaseClient,
  stagingCompanyId: string,
): Promise<string | null> {
  return fetchStagingCanonicalCompanyId(admin, stagingCompanyId)
}

export async function loadCanonicalPersonIndexesFromDb(admin: SupabaseClient): Promise<{
  emails: Array<{ person_id: string; normalized_email: string }>
  phones: Array<{ person_id: string; normalized_phone: string }>
  profiles: Array<{ person_id: string; normalized_profile_key: string }>
  roles: Array<{ person_id: string; company_id: string; normalized_name: string }>
}> {
  const { data: emails, error: eErr } = await admin
    .schema("growth")
    .from("person_emails")
    .select("person_id, normalized_email")
    .neq("normalized_email", "")
    .limit(100000)
  if (eErr) throw new Error(`loadCanonicalPersonIndexesFromDb emails: ${eErr.message}`)

  const { data: phones, error: pErr } = await admin
    .schema("growth")
    .from("person_phones")
    .select("person_id, normalized_phone")
    .neq("normalized_phone", "")
    .limit(100000)
  if (pErr) throw new Error(`loadCanonicalPersonIndexesFromDb phones: ${pErr.message}`)

  const { data: profiles, error: prErr } = await admin
    .schema("growth")
    .from("person_profiles")
    .select("person_id, normalized_profile_key")
    .neq("normalized_profile_key", "")
    .limit(100000)
  if (prErr) throw new Error(`loadCanonicalPersonIndexesFromDb profiles: ${prErr.message}`)

  const { data: roles, error: rErr } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("person_id, company_id, person:persons(normalized_name)")
    .limit(100000)
  if (rErr) {
    const { data: rolesFlat, error: rErr2 } = await admin
      .schema("growth")
      .from("person_company_roles")
      .select("person_id, company_id")
      .limit(100000)
    if (rErr2) throw new Error(`loadCanonicalPersonIndexesFromDb roles: ${rErr2.message}`)
    const personIds = [...new Set((rolesFlat ?? []).map((r) => asString((r as { person_id: string }).person_id)))]
    const nameByPerson = new Map<string, string>()
    if (personIds.length > 0) {
      const { data: persons } = await admin
        .schema("growth")
        .from("persons")
        .select("id, normalized_name")
        .in("id", personIds.slice(0, 500))
      for (const p of persons ?? []) {
        nameByPerson.set(asString((p as { id: string }).id), asString((p as { normalized_name: string }).normalized_name))
      }
    }
    return {
      emails: (emails ?? []) as Array<{ person_id: string; normalized_email: string }>,
      phones: (phones ?? []) as Array<{ person_id: string; normalized_phone: string }>,
      profiles: (profiles ?? []) as Array<{ person_id: string; normalized_profile_key: string }>,
      roles: (rolesFlat ?? []).map((r) => ({
        person_id: asString((r as { person_id: string }).person_id),
        company_id: asString((r as { company_id: string }).company_id),
        normalized_name: nameByPerson.get(asString((r as { person_id: string }).person_id)) ?? "",
      })),
    }
  }

  return {
    emails: (emails ?? []) as Array<{ person_id: string; normalized_email: string }>,
    phones: (phones ?? []) as Array<{ person_id: string; normalized_phone: string }>,
    profiles: (profiles ?? []) as Array<{ person_id: string; normalized_profile_key: string }>,
    roles: (roles ?? []).map((r) => {
      const row = r as {
        person_id: string
        company_id: string
        person?: { normalized_name?: string } | Array<{ normalized_name?: string }>
      }
      const person = Array.isArray(row.person) ? row.person[0] : row.person
      return {
        person_id: asString(row.person_id),
        company_id: asString(row.company_id),
        normalized_name: asString(person?.normalized_name),
      }
    }),
  }
}

export async function countCanonicalPersons(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("persons")
    .select("id", { count: "exact", head: true })
  if (error) throw new Error(`countCanonicalPersons: ${error.message}`)
  return count ?? 0
}

export async function persistCanonicalPersonChannels(
  admin: SupabaseClient,
  input: GrowthCanonicalPersonCandidateInput,
  personId: string,
  resolution: GrowthCanonicalPersonResolutionResult,
): Promise<void> {
  const observed = input.observed_at ?? new Date().toISOString()
  const meta = input.source_metadata ?? {}
  const channelBase = {
    source_table: input.source_table,
    source_id: input.source_id,
    provider_name: input.provider_name,
    discovery_source: input.discovery_source,
    observed_at: observed,
    metadata: meta,
  }

  const email = canonicalNormalizedPersonEmail(input.email)
  if (email && input.email) {
    await upsertCanonicalPersonEmail(admin, {
      person_id: personId,
      email: input.email.trim(),
      normalized_email: email,
      email_type: "work",
      is_primary: true,
      verification_status: input.email_verification_status ?? "unverified",
      confidence: resolutionConfidenceFromPersonMethod(resolution.resolution_method, input.confidence),
      ...channelBase,
    })
  }

  const phone = canonicalNormalizedPersonPhone(input.phone)
  if (phone && input.phone) {
    await upsertCanonicalPersonPhone(admin, {
      person_id: personId,
      phone: input.phone.trim(),
      normalized_phone: phone,
      phone_type: "unknown",
      is_primary: true,
      verification_status: input.phone_verification_status ?? "unverified",
      confidence: resolutionConfidenceFromPersonMethod(resolution.resolution_method, input.confidence),
      ...channelBase,
    })
  }

  const linkedinKey = canonicalNormalizedPersonLinkedIn(input.linkedin_url)
  if (linkedinKey && input.linkedin_url) {
    await upsertCanonicalPersonProfile(admin, {
      person_id: personId,
      profile_type: "linkedin",
      profile_url: input.linkedin_url.trim(),
      normalized_profile_key: linkedinKey,
      confidence: resolutionConfidenceFromPersonMethod(resolution.resolution_method, input.confidence),
      ...channelBase,
    })
  }

  if (input.canonical_company_id) {
    await upsertCanonicalPersonCompanyRole(admin, {
      person_id: personId,
      company_id: input.canonical_company_id,
      title: input.title ?? null,
      department: input.department ?? null,
      seniority: input.seniority ?? null,
      role_type: input.role_type ?? "unknown",
      is_primary: true,
      confidence: resolutionConfidenceFromPersonMethod(resolution.resolution_method, input.confidence),
      ...channelBase,
    })
  }
}
