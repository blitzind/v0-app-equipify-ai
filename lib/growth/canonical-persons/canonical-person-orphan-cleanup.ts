/**
 * Phase 7.2B — Remove orphan canonical persons (failed apply retries with no channels/lineage).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_CANONICAL_PERSON_ORPHAN_CLEANUP_QA_MARKER =
  "growth-canonical-person-orphan-cleanup-7.2b-v1" as const

export type CanonicalPersonOrphanRecord = {
  person_id: string
  has_lineage: boolean
  has_email: boolean
  has_phone: boolean
  has_profile: boolean
  has_company_role: boolean
  has_merge_event: boolean
}

export type CanonicalPersonOrphanCleanupResult = {
  qa_marker: typeof GROWTH_CANONICAL_PERSON_ORPHAN_CLEANUP_QA_MARKER
  mode: "dry_run" | "apply"
  orphan_count: number
  deleted_count: number
  person_ids: string[]
}

/** True only when the person has no lineage, channels, roles, or merge history. */
export function isDeletableOrphanCanonicalPerson(record: CanonicalPersonOrphanRecord): boolean {
  return (
    !record.has_lineage &&
    !record.has_email &&
    !record.has_phone &&
    !record.has_profile &&
    !record.has_company_role &&
    !record.has_merge_event
  )
}

async function listPersonIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.schema("growth").from("persons").select("id")
  if (error) throw new Error(`listPersonIds: ${error.message}`)
  return (data ?? [])
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean)
}

async function personIdsWithRows(
  admin: SupabaseClient,
  table:
    | "person_source_lineage"
    | "person_emails"
    | "person_phones"
    | "person_profiles"
    | "person_company_roles",
  column: "person_id",
): Promise<Set<string>> {
  const { data, error } = await admin.schema("growth").from(table).select(column)
  if (error) throw new Error(`${table}: ${error.message}`)
  const ids = new Set<string>()
  for (const row of data ?? []) {
    const id = row[column]
    if (typeof id === "string" && id) ids.add(id)
  }
  return ids
}

async function personIdsInMergeEvents(admin: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await admin
    .schema("growth")
    .from("person_merge_events")
    .select("survivor_person_id, merged_person_id")
  if (error) throw new Error(`person_merge_events: ${error.message}`)
  const ids = new Set<string>()
  for (const row of data ?? []) {
    const survivor = row.survivor_person_id
    const merged = row.merged_person_id
    if (typeof survivor === "string" && survivor) ids.add(survivor)
    if (typeof merged === "string" && merged) ids.add(merged)
  }
  return ids
}

export async function findDeletableOrphanCanonicalPersons(
  admin: SupabaseClient,
): Promise<CanonicalPersonOrphanRecord[]> {
  const personIds = await listPersonIds(admin)
  if (personIds.length === 0) return []

  const [lineage, emails, phones, profiles, roles, mergeEvents] = await Promise.all([
    personIdsWithRows(admin, "person_source_lineage", "person_id"),
    personIdsWithRows(admin, "person_emails", "person_id"),
    personIdsWithRows(admin, "person_phones", "person_id"),
    personIdsWithRows(admin, "person_profiles", "person_id"),
    personIdsWithRows(admin, "person_company_roles", "person_id"),
    personIdsInMergeEvents(admin),
  ])

  const orphans: CanonicalPersonOrphanRecord[] = []
  for (const person_id of personIds) {
    const record: CanonicalPersonOrphanRecord = {
      person_id,
      has_lineage: lineage.has(person_id),
      has_email: emails.has(person_id),
      has_phone: phones.has(person_id),
      has_profile: profiles.has(person_id),
      has_company_role: roles.has(person_id),
      has_merge_event: mergeEvents.has(person_id),
    }
    if (isDeletableOrphanCanonicalPerson(record)) {
      orphans.push(record)
    }
  }
  return orphans
}

export async function runCanonicalPersonOrphanCleanup(
  admin: SupabaseClient,
  options: { apply: boolean },
): Promise<CanonicalPersonOrphanCleanupResult> {
  const orphans = await findDeletableOrphanCanonicalPersons(admin)
  const person_ids = orphans.map((o) => o.person_id)

  if (!options.apply || person_ids.length === 0) {
    return {
      qa_marker: GROWTH_CANONICAL_PERSON_ORPHAN_CLEANUP_QA_MARKER,
      mode: options.apply ? "apply" : "dry_run",
      orphan_count: person_ids.length,
      deleted_count: 0,
      person_ids,
    }
  }

  const { error, count } = await admin
    .schema("growth")
    .from("persons")
    .delete({ count: "exact" })
    .in("id", person_ids)

  if (error) throw new Error(`delete orphan persons: ${error.message}`)

  return {
    qa_marker: GROWTH_CANONICAL_PERSON_ORPHAN_CLEANUP_QA_MARKER,
    mode: "apply",
    orphan_count: person_ids.length,
    deleted_count: count ?? person_ids.length,
    person_ids,
  }
}
