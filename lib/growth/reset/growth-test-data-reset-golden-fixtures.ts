/**
 * GS-GROWTH-OPS-7B — Resolve golden certification fixture IDs for reset preservation.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_TEST_DATA_RESET_QA_MARKER,
  parseCsvEnvIds,
  PRECISION_BIOMEDICAL_ORG_NAME,
  PRECISION_BIOMEDICAL_ORG_SLUG,
  PRESERVED_CALL_SESSION_IDS_ENV,
  PRESERVED_COMPANY_IDS_ENV,
  PRESERVED_CONTACT_IDS_ENV,
  PRESERVED_GENERATION_IDS_ENV,
  PRESERVED_INBOX_THREAD_IDS_ENV,
  PRESERVED_LEAD_IDS_ENV,
  PRESERVED_MEETING_IDS_ENV,
  PRESERVED_OPPORTUNITY_IDS_ENV,
  PRESERVED_ORGANIZATION_IDS_ENV,
  PRESERVED_PERSON_IDS_ENV,
  PRESERVED_SEQUENCE_ENROLLMENT_IDS_ENV,
} from "./growth-test-data-reset-constants"

export type GrowthResetGoldenFixtures = {
  qa_marker: typeof GROWTH_TEST_DATA_RESET_QA_MARKER
  organization_ids: string[]
  lead_ids: string[]
  company_ids: string[]
  contact_ids: string[]
  person_ids: string[]
  opportunity_ids: string[]
  meeting_ids: string[]
  generation_ids: string[]
  sequence_enrollment_ids: string[]
  inbox_thread_ids: string[]
  call_session_ids: string[]
  timeline_lead_ids: string[]
  resolution_notes: string[]
  missing_requirements: string[]
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

function metadataIsGolden(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false
  const fixtureType = (metadata as { fixture_type?: unknown }).fixture_type
  return fixtureType === "golden" || fixtureType === "certification"
}

async function resolveOrganizations(admin: SupabaseClient): Promise<{ ids: string[]; notes: string[] }> {
  const envIds = parseCsvEnvIds(PRESERVED_ORGANIZATION_IDS_ENV)
  if (envIds.length > 0) {
    return { ids: unique(envIds), notes: ["organization_ids from env allowlist"] }
  }

  const notes: string[] = []
  const ids: string[] = []

  const { data: bySlug, error: slugErr } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", PRECISION_BIOMEDICAL_ORG_SLUG)
  if (slugErr) throw new Error(`organizations slug lookup: ${slugErr.message}`)
  for (const row of bySlug ?? []) {
    if (typeof row.id === "string") ids.push(row.id)
  }
  if (ids.length > 0) notes.push(`matched slug ${PRECISION_BIOMEDICAL_ORG_SLUG}`)

  const { data: byName, error: nameErr } = await admin
    .from("organizations")
    .select("id, name, slug")
    .ilike("name", `%${PRECISION_BIOMEDICAL_ORG_NAME}%`)
  if (nameErr) throw new Error(`organizations name lookup: ${nameErr.message}`)
  for (const row of byName ?? []) {
    if (typeof row.id === "string") ids.push(row.id)
  }
  if ((byName ?? []).length > 0) notes.push(`matched name ${PRECISION_BIOMEDICAL_ORG_NAME}`)

  return { ids: unique(ids), notes }
}

async function pickLeadIds(admin: SupabaseClient, orgIds: string[]): Promise<string[]> {
  const envIds = parseCsvEnvIds(PRESERVED_LEAD_IDS_ENV)
  if (envIds.length > 0) return unique(envIds)

  const ids: string[] = []

  const { data: goldenMeta, error: metaErr } = await admin
    .schema("growth")
    .from("leads")
    .select("id, metadata, company_name, promoted_organization_id, created_at")
    .order("created_at", { ascending: true })
    .limit(200)
  if (metaErr) throw new Error(`leads golden metadata scan: ${metaErr.message}`)

  for (const row of goldenMeta ?? []) {
    if (metadataIsGolden(row.metadata) && typeof row.id === "string") {
      ids.push(row.id)
    }
  }
  if (ids.length > 0) return unique(ids).slice(0, 1)

  for (const row of goldenMeta ?? []) {
    const company = typeof row.company_name === "string" ? row.company_name : ""
    if (/precision biomedical/i.test(company) && typeof row.id === "string") {
      ids.push(row.id)
      break
    }
  }
  if (ids.length > 0) return unique(ids).slice(0, 1)

  if (orgIds.length > 0) {
    const { data: promoted, error: promotedErr } = await admin
      .schema("growth")
      .from("leads")
      .select("id, promoted_organization_id, created_at")
      .in("promoted_organization_id", orgIds)
      .order("created_at", { ascending: true })
      .limit(1)
    if (promotedErr) throw new Error(`leads promoted org lookup: ${promotedErr.message}`)
    for (const row of promoted ?? []) {
      if (typeof row.id === "string") ids.push(row.id)
    }
  }

  return unique(ids).slice(0, 1)
}

async function pickRelatedIds(
  admin: SupabaseClient,
  table: string,
  column: string,
  leadIds: string[],
  envKey: string,
  limit = 1,
): Promise<string[]> {
  const envIds = parseCsvEnvIds(envKey)
  if (envIds.length > 0) return unique(envIds).slice(0, limit)
  if (leadIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from(table)
    .select(`id, ${column}, created_at`)
    .in(column, leadIds)
    .order("created_at", { ascending: true })
    .limit(limit)
  if (error) throw new Error(`${table} lookup: ${error.message}`)

  return unique(
    (data ?? [])
      .map((row) => (typeof row.id === "string" ? row.id : ""))
      .filter(Boolean),
  ).slice(0, limit)
}

async function pickCompanyIds(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<string[]> {
  const envIds = parseCsvEnvIds(PRESERVED_COMPANY_IDS_ENV)
  if (envIds.length > 0) return unique(envIds).slice(0, 1)
  if (leadIds.length === 0) return []

  const { data: leadRows, error: leadErr } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name")
    .in("id", leadIds)
  if (leadErr) throw new Error(`leads company_name lookup: ${leadErr.message}`)

  const names = unique(
    (leadRows ?? [])
      .map((row) => (typeof row.company_name === "string" ? row.company_name.trim() : ""))
      .filter(Boolean),
  )
  if (names.length === 0) return []

  const { data: companies, error: companyErr } = await admin
    .schema("growth")
    .from("companies")
    .select("id, name, created_at")
    .in("name", names)
    .order("created_at", { ascending: true })
    .limit(1)
  if (companyErr) throw new Error(`companies lookup: ${companyErr.message}`)

  const ids = (companies ?? [])
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean)
  if (ids.length > 0) return unique(ids).slice(0, 1)

  const { data: fuzzy, error: fuzzyErr } = await admin
    .schema("growth")
    .from("companies")
    .select("id, name, created_at")
    .ilike("name", "%Precision Biomedical%")
    .order("created_at", { ascending: true })
    .limit(1)
  if (fuzzyErr) throw new Error(`companies fuzzy lookup: ${fuzzyErr.message}`)

  return unique(
    (fuzzy ?? []).map((row) => (typeof row.id === "string" ? row.id : "")).filter(Boolean),
  ).slice(0, 1)
}

async function pickContactAndPersonIds(
  admin: SupabaseClient,
  companyIds: string[],
  leadIds: string[],
): Promise<{ contact_ids: string[]; person_ids: string[] }> {
  const envContact = parseCsvEnvIds(PRESERVED_CONTACT_IDS_ENV)
  const envPerson = parseCsvEnvIds(PRESERVED_PERSON_IDS_ENV)
  if (envContact.length > 0 || envPerson.length > 0) {
    return {
      contact_ids: unique(envContact).slice(0, 1),
      person_ids: unique(envPerson).slice(0, 1),
    }
  }

  if (companyIds.length > 0) {
    const { data: contacts, error } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id, person_id, company_id, created_at")
      .in("company_id", companyIds)
      .order("created_at", { ascending: true })
      .limit(1)
    if (error) throw new Error(`company_contacts lookup: ${error.message}`)
    const contact = contacts?.[0]
    if (contact && typeof contact.id === "string") {
      const personId =
        typeof contact.person_id === "string" && contact.person_id ? [contact.person_id] : []
      return { contact_ids: [contact.id], person_ids: personId }
    }
  }

  if (leadIds.length > 0) {
    const { data: roles, error } = await admin
      .schema("growth")
      .from("person_company_roles")
      .select("person_id, created_at")
      .order("created_at", { ascending: true })
      .limit(5)
    if (error) throw new Error(`person_company_roles lookup: ${error.message}`)
    const personId = roles?.find((row) => typeof row.person_id === "string")?.person_id
    if (typeof personId === "string") {
      return { contact_ids: [], person_ids: [personId] }
    }
  }

  return { contact_ids: [], person_ids: [] }
}

async function pickGenerationIds(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<string[]> {
  const envIds = parseCsvEnvIds(PRESERVED_GENERATION_IDS_ENV)
  if (envIds.length > 0) return unique(envIds).slice(0, 1)
  if (leadIds.length === 0) return []

  const { data: approved, error: approvedErr } = await admin
    .schema("growth")
    .from("personalization_generations")
    .select("id, lead_id, status, created_at")
    .in("lead_id", leadIds)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(1)
  if (approvedErr) throw new Error(`personalization_generations approved lookup: ${approvedErr.message}`)
  if (approved?.[0]?.id && typeof approved[0].id === "string") return [approved[0].id]

  return pickRelatedIds(admin, "personalization_generations", "lead_id", leadIds, PRESERVED_GENERATION_IDS_ENV, 1)
}

async function pickSequenceEnrollmentIds(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<string[]> {
  const envIds = parseCsvEnvIds(PRESERVED_SEQUENCE_ENROLLMENT_IDS_ENV)
  if (envIds.length > 0) return unique(envIds).slice(0, 1)
  if (leadIds.length === 0) return []

  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, lead_id, status, created_at")
    .in("lead_id", leadIds)
    .in("status", ["active", "approved", "completed", "paused"])
    .order("created_at", { ascending: true })
    .limit(1)
  if (error) throw new Error(`sequence_enrollments lookup: ${error.message}`)

  const id = data?.[0]?.id
  if (typeof id === "string") return [id]

  return pickRelatedIds(
    admin,
    "sequence_enrollments",
    "lead_id",
    leadIds,
    PRESERVED_SEQUENCE_ENROLLMENT_IDS_ENV,
    1,
  )
}

async function pickCallSessionIds(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<string[]> {
  const envIds = parseCsvEnvIds(PRESERVED_CALL_SESSION_IDS_ENV)
  if (envIds.length > 0) return unique(envIds).slice(0, 1)
  if (leadIds.length === 0) return []

  const leadCall = await pickRelatedIds(
    admin,
    "lead_call_sessions",
    "lead_id",
    leadIds,
    PRESERVED_CALL_SESSION_IDS_ENV,
    1,
  )
  if (leadCall.length > 0) return leadCall

  return pickRelatedIds(
    admin,
    "native_call_workspace_sessions",
    "lead_id",
    leadIds,
    PRESERVED_CALL_SESSION_IDS_ENV,
    1,
  )
}

export async function resolveGrowthResetGoldenFixtures(
  admin: SupabaseClient,
): Promise<GrowthResetGoldenFixtures> {
  const resolution_notes: string[] = []
  const missing_requirements: string[] = []

  const orgResolution = await resolveOrganizations(admin)
  resolution_notes.push(...orgResolution.notes)
  const organization_ids = orgResolution.ids

  const lead_ids = await pickLeadIds(admin, organization_ids)
  if (lead_ids.length === 0) missing_requirements.push("golden lead")

  const company_ids = await pickCompanyIds(admin, lead_ids)
  if (company_ids.length === 0) missing_requirements.push("golden company")

  const { contact_ids, person_ids } = await pickContactAndPersonIds(admin, company_ids, lead_ids)
  if (contact_ids.length === 0 && person_ids.length === 0) {
    missing_requirements.push("golden contact/person")
  }

  const opportunity_ids = await pickRelatedIds(
    admin,
    "opportunities",
    "lead_id",
    lead_ids,
    PRESERVED_OPPORTUNITY_IDS_ENV,
    1,
  )
  if (opportunity_ids.length === 0) missing_requirements.push("golden opportunity")

  const meeting_ids = await pickRelatedIds(
    admin,
    "meetings",
    "lead_id",
    lead_ids,
    PRESERVED_MEETING_IDS_ENV,
    1,
  )
  if (meeting_ids.length === 0) missing_requirements.push("golden meeting")

  const generation_ids = await pickGenerationIds(admin, lead_ids)
  if (generation_ids.length === 0) missing_requirements.push("golden personalization generation")

  const sequence_enrollment_ids = await pickSequenceEnrollmentIds(admin, lead_ids)
  if (sequence_enrollment_ids.length === 0) {
    missing_requirements.push("golden sequence enrollment")
  }

  const inbox_thread_ids = await pickRelatedIds(
    admin,
    "inbox_threads",
    "lead_id",
    lead_ids,
    PRESERVED_INBOX_THREAD_IDS_ENV,
    1,
  )
  if (inbox_thread_ids.length === 0) missing_requirements.push("golden inbox thread")

  const call_session_ids = await pickCallSessionIds(admin, lead_ids)
  if (call_session_ids.length === 0) missing_requirements.push("golden call session")

  return {
    qa_marker: GROWTH_TEST_DATA_RESET_QA_MARKER,
    organization_ids,
    lead_ids,
    company_ids,
    contact_ids,
    person_ids,
    opportunity_ids,
    meeting_ids,
    generation_ids,
    sequence_enrollment_ids,
    inbox_thread_ids,
    call_session_ids,
    timeline_lead_ids: lead_ids,
    resolution_notes,
    missing_requirements,
  }
}

export function getGoldenPreservedIdsForTable(
  table: string,
  fixtures: GrowthResetGoldenFixtures,
): string[] {
  switch (table) {
    case "leads":
      return fixtures.lead_ids
    case "companies":
      return fixtures.company_ids
    case "company_contacts":
      return fixtures.contact_ids
    case "persons":
    case "person_emails":
    case "person_phones":
    case "person_profiles":
    case "person_company_roles":
    case "person_source_lineage":
      return fixtures.person_ids
    case "opportunities":
      return fixtures.opportunity_ids
    case "meetings":
      return fixtures.meeting_ids
    case "personalization_generations":
      return fixtures.generation_ids
    case "sequence_enrollments":
      return fixtures.sequence_enrollment_ids
    case "inbox_threads":
      return fixtures.inbox_thread_ids
    case "lead_call_sessions":
    case "native_call_workspace_sessions":
      return fixtures.call_session_ids
    default:
      return []
  }
}

export function getGoldenPreservedFkValues(
  fkColumn: string,
  fixtures: GrowthResetGoldenFixtures,
): string[] {
  switch (fkColumn) {
    case "lead_id":
      return fixtures.lead_ids
    case "company_id":
      return fixtures.company_ids
    case "opportunity_id":
      return fixtures.opportunity_ids
    case "meeting_id":
      return fixtures.meeting_ids
    case "thread_id":
      return fixtures.inbox_thread_ids
    case "enrollment_id":
      return fixtures.sequence_enrollment_ids
    case "generation_id":
      return fixtures.generation_ids
    case "person_id":
      return fixtures.person_ids
    default:
      return []
  }
}
