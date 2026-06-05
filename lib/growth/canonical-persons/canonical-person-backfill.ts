import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapCompanyContactRow,
  mapContactCandidateRow,
  mapLeadDecisionMakerRow,
  selectForPersonSourceTable,
} from "@/lib/growth/canonical-persons/canonical-person-candidate-mappers"
import {
  fetchPendingBySource,
  resolveBackfillDoneState,
  sumPendingTotal,
  verifyCanonicalPersonBackfillComplete,
} from "@/lib/growth/canonical-persons/canonical-person-backfill-completion"
import {
  canonicalNameCompanyKey,
  canonicalNormalizedPersonEmail,
} from "@/lib/growth/canonical-persons/canonical-person-normalize"
import {
  buildCanonicalPersonInsertPayload,
  countCanonicalPersons,
  fetchLineagePersonId,
  fetchStagingCanonicalCompanyId,
  insertCanonicalPerson,
  loadCanonicalPersonIndexesFromDb,
  persistCanonicalPersonChannels,
  resolveCanonicalCompanyIdForCompanyContact,
  resolveCanonicalCompanyIdForLead,
  touchCanonicalPersonSeen,
  updateStagingCanonicalPersonId,
  upsertCanonicalPersonLineage,
} from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import {
  createEmptyCanonicalPersonResolverIndexes,
  registerCanonicalPersonInIndexes,
  registerNewCanonicalPersonFromCandidate,
  resolveCanonicalPerson,
  type CanonicalPersonResolverIndexes,
} from "@/lib/growth/canonical-persons/canonical-person-resolver"
export { simulateCanonicalPersonBackfill } from "@/lib/growth/canonical-persons/canonical-person-simulate"
import {
  GROWTH_CANONICAL_PERSON_QA_MARKER,
  GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE,
  GROWTH_CANONICAL_PERSON_BACKFILL_MAX_BATCH_SIZE,
  type GrowthCanonicalPersonBackfillCursor,
  type GrowthCanonicalPersonBackfillErrorRow,
  type GrowthCanonicalPersonBackfillResult,
  type GrowthCanonicalPersonBackfillStats,
  type GrowthCanonicalPersonCandidateInput,
  type GrowthCanonicalPersonSourceTable,
} from "@/lib/growth/canonical-persons/canonical-person-types"

const DEFAULT_SOURCES: GrowthCanonicalPersonSourceTable[] = [
  "contact_candidates",
  "company_contacts",
  "lead_decision_makers",
]

type ProcessCandidateResult = { ok: true } | { ok: false; error: string }

function emptySourceStats() {
  return {
    rows_processed: 0,
    already_linked: 0,
    resolved_normalized_email: 0,
    resolved_normalized_linkedin: 0,
    resolved_normalized_phone: 0,
    resolved_name_company: 0,
    would_create_new: 0,
    errors: 0,
  }
}

function emptyStats(mode: "dry_run" | "apply", existingCount: number): GrowthCanonicalPersonBackfillStats {
  return {
    qa_marker: GROWTH_CANONICAL_PERSON_QA_MARKER,
    mode,
    sources: {
      contact_candidates: emptySourceStats(),
      company_contacts: emptySourceStats(),
      lead_decision_makers: emptySourceStats(),
    },
    canonical_persons_existing: existingCount,
    canonical_persons_after: existingCount,
    unique_normalized_emails: 0,
    merge_groups_by_email: 0,
  }
}

function buildIndexesFromDb(
  loaded: Awaited<ReturnType<typeof loadCanonicalPersonIndexesFromDb>>,
): CanonicalPersonResolverIndexes {
  const indexes = createEmptyCanonicalPersonResolverIndexes()
  for (const e of loaded.emails) {
    if (!indexes.by_normalized_email.has(e.normalized_email)) {
      indexes.by_normalized_email.set(e.normalized_email, e.person_id)
    }
  }
  for (const p of loaded.phones) {
    if (!indexes.by_normalized_phone.has(p.normalized_phone)) {
      indexes.by_normalized_phone.set(p.normalized_phone, p.person_id)
    }
  }
  for (const pr of loaded.profiles) {
    if (!indexes.by_normalized_linkedin.has(pr.normalized_profile_key)) {
      indexes.by_normalized_linkedin.set(pr.normalized_profile_key, pr.person_id)
    }
  }
  for (const r of loaded.roles) {
    const key = canonicalNameCompanyKey(r.company_id, r.normalized_name)
    if (key && !indexes.by_name_company.has(key)) {
      indexes.by_name_company.set(key, r.person_id)
    }
  }
  return indexes
}

function bumpStats(
  stats: GrowthCanonicalPersonBackfillStats["sources"][GrowthCanonicalPersonSourceTable],
  resolution: ReturnType<typeof resolveCanonicalPerson>,
): void {
  stats.rows_processed++
  if (resolution.would_create_new) stats.would_create_new++
  switch (resolution.resolution_method) {
    case "normalized_email":
      stats.resolved_normalized_email++
      break
    case "normalized_linkedin":
      stats.resolved_normalized_linkedin++
      break
    case "normalized_phone":
      stats.resolved_normalized_phone++
      break
    case "name_company":
      stats.resolved_name_company++
      break
    default:
      break
  }
}

function mergeGroupsFromEmailCounts(emailCounts: Record<string, number>): number {
  let mergeGroups = 0
  for (const count of Object.values(emailCounts)) {
    if (count > 1) mergeGroups++
  }
  return mergeGroups
}

function trackEmail(emailCounts: Record<string, number>, email: string | null): void {
  if (!email) return
  emailCounts[email] = (emailCounts[email] ?? 0) + 1
}

function totalErrors(stats: GrowthCanonicalPersonBackfillStats): number {
  return DEFAULT_SOURCES.reduce((sum, table) => sum + stats.sources[table].errors, 0)
}

function totalWouldCreate(stats: GrowthCanonicalPersonBackfillStats): number {
  return DEFAULT_SOURCES.reduce((sum, table) => sum + stats.sources[table].would_create_new, 0)
}

export async function countUnlinkedStagingPersonSources(
  admin: SupabaseClient,
  table: GrowthCanonicalPersonSourceTable,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from(table)
    .select("id", { count: "exact", head: true })
    .is("canonical_person_id", null)
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function fetchPendingChunk(
  admin: SupabaseClient,
  table: GrowthCanonicalPersonSourceTable,
  afterId: string | null,
  limit: number,
): Promise<Record<string, unknown>[]> {
  let query = admin
    .schema("growth")
    .from(table)
    .select(selectForPersonSourceTable(table))
    .is("canonical_person_id", null)
    .order("id", { ascending: true })
    .limit(limit)

  if (afterId) {
    query = query.gt("id", afterId)
  }

  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data ?? []) as Record<string, unknown>[]
}

async function enrichCandidateInput(
  admin: SupabaseClient,
  input: GrowthCanonicalPersonCandidateInput,
): Promise<GrowthCanonicalPersonCandidateInput> {
  if (input.canonical_company_id) return input

  if (input.source_table === "contact_candidates" && input.company_candidate_id) {
    const canonical_company_id = await fetchStagingCanonicalCompanyId(
      admin,
      input.company_candidate_id,
    )
    return { ...input, canonical_company_id }
  }

  if (input.source_table === "company_contacts") {
    const companyId = asString(input.source_metadata?.company_id)
    if (companyId) {
      const canonical_company_id = await resolveCanonicalCompanyIdForCompanyContact(admin, companyId)
      return { ...input, canonical_company_id }
    }
  }

  if (input.source_table === "lead_decision_makers" && input.lead_id) {
    const canonical_company_id = await resolveCanonicalCompanyIdForLead(admin, input.lead_id)
    return { ...input, canonical_company_id }
  }

  return input
}

function mapRow(
  table: GrowthCanonicalPersonSourceTable,
  row: Record<string, unknown>,
  leadCompanyMap: Map<string, string | null>,
): GrowthCanonicalPersonCandidateInput {
  if (table === "contact_candidates") return mapContactCandidateRow(row)
  if (table === "company_contacts") return mapCompanyContactRow(row)
  const leadId = asString(row.lead_id)
  return mapLeadDecisionMakerRow(row, leadCompanyMap.get(leadId) ?? null)
}

async function buildLeadCompanyMap(
  admin: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  const leadIds = [...new Set(rows.map((r) => asString(r.lead_id)).filter(Boolean))]
  await Promise.all(
    leadIds.map(async (leadId) => {
      map.set(leadId, await resolveCanonicalCompanyIdForLead(admin, leadId))
    }),
  )
  return map
}

async function processCandidate(
  admin: SupabaseClient,
  input: GrowthCanonicalPersonCandidateInput,
  indexes: CanonicalPersonResolverIndexes,
  mode: "dry_run" | "apply",
  stats: GrowthCanonicalPersonBackfillStats["sources"][GrowthCanonicalPersonSourceTable],
): Promise<ProcessCandidateResult> {
  try {
    const enriched = await enrichCandidateInput(admin, input)

    const existingLineage = await fetchLineagePersonId(
      admin,
      enriched.source_table,
      enriched.source_id,
    )
    if (existingLineage) {
      stats.already_linked++
      stats.rows_processed++
      if (mode === "apply") {
        await updateStagingCanonicalPersonId(
          admin,
          enriched.source_table,
          enriched.source_id,
          existingLineage,
        )
      }
      return { ok: true }
    }

    const resolution = resolveCanonicalPerson(enriched, indexes)
    bumpStats(stats, resolution)

    if (mode === "dry_run") {
      if (resolution.would_create_new) {
        const dryId = resolution.normalized_email
          ? `dry-${resolution.normalized_email}`
          : `dry-${enriched.source_table}-${enriched.source_id}`
        registerNewCanonicalPersonFromCandidate(indexes, dryId, enriched, resolution)
      } else if (resolution.person_id) {
        registerNewCanonicalPersonFromCandidate(indexes, resolution.person_id, enriched, resolution)
      }
      return { ok: true }
    }

    let personId = resolution.person_id
    if (!personId) {
      const payload = buildCanonicalPersonInsertPayload(enriched, "new")
      personId = await insertCanonicalPerson(admin, payload)
      registerNewCanonicalPersonFromCandidate(indexes, personId, enriched, resolution)
    } else {
      registerNewCanonicalPersonFromCandidate(indexes, personId, enriched, resolution)
      await touchCanonicalPersonSeen(admin, personId, enriched.observed_at ?? new Date().toISOString())
    }

    await persistCanonicalPersonChannels(admin, enriched, personId, resolution)

    const observed = enriched.observed_at ?? new Date().toISOString()
    await upsertCanonicalPersonLineage(admin, {
      person_id: personId,
      source_table: enriched.source_table,
      source_id: enriched.source_id,
      provider_name: enriched.provider_name,
      discovery_source: enriched.discovery_source,
      confidence: enriched.confidence ?? 0,
      observed_at: observed,
      metadata: enriched.source_metadata ?? {},
    })
    await updateStagingCanonicalPersonId(admin, enriched.source_table, enriched.source_id, personId)
    return { ok: true }
  } catch (e) {
    stats.errors++
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}

function recordErrorRow(
  error_rows: GrowthCanonicalPersonBackfillErrorRow[],
  table: GrowthCanonicalPersonSourceTable,
  sourceId: string,
  message: string,
): void {
  error_rows.push({ source_table: table, source_id: sourceId, message })
}

async function finalizeBackfillResult(
  admin: SupabaseClient,
  input: {
    mode: "dry_run" | "apply"
    sources: GrowthCanonicalPersonSourceTable[]
    stats: GrowthCanonicalPersonBackfillStats
    indexes: CanonicalPersonResolverIndexes
    identityCounts: Record<string, number>
    existingCount: number
    error_rows: GrowthCanonicalPersonBackfillErrorRow[]
    progress: GrowthCanonicalPersonBackfillResult["progress"]
    tableWalkComplete: boolean
  },
): Promise<GrowthCanonicalPersonBackfillResult> {
  const { mode, sources, stats, indexes, identityCounts, existingCount, error_rows, progress, tableWalkComplete } =
    input

  stats.merge_groups_by_email = mergeGroupsFromEmailCounts(identityCounts)
  stats.unique_normalized_emails = indexes.by_normalized_email.size
  stats.canonical_persons_after =
    mode === "apply" ? await countCanonicalPersons(admin) : existingCount + totalWouldCreate(stats)

  const verification = tableWalkComplete
    ? await verifyCanonicalPersonBackfillComplete(admin, countUnlinkedStagingPersonSources)
    : null

  const pending_by_source =
    verification?.pending_by_source ??
    (await fetchPendingBySource(admin, countUnlinkedStagingPersonSources))
  const pending_total = verification?.pending_total ?? sumPendingTotal(pending_by_source)

  const resolved = resolveBackfillDoneState({
    sources,
    identity_counts: identityCounts,
    error_count: totalErrors(stats),
    verification: verification ?? {
      passed: pending_total === 0,
      pending_by_source,
      pending_total,
    },
  })

  return {
    stats,
    done: resolved.done,
    cursor: resolved.cursor,
    progress,
    pending_by_source,
    pending_total,
    error_rows,
    verification,
    certification: resolved.certification,
  }
}

function resolveBatchSize(batchSize?: number): number | null {
  if (batchSize == null) return null
  return Math.min(
    GROWTH_CANONICAL_PERSON_BACKFILL_MAX_BATCH_SIZE,
    Math.max(1, Math.floor(batchSize)),
  )
}

function resolveStartTable(
  sources: GrowthCanonicalPersonSourceTable[],
  cursor: GrowthCanonicalPersonBackfillCursor | null | undefined,
): GrowthCanonicalPersonSourceTable {
  if (cursor?.source_table && sources.includes(cursor.source_table)) {
    return cursor.source_table
  }
  return sources[0]
}

function nextSourceTable(
  sources: GrowthCanonicalPersonSourceTable[],
  current: GrowthCanonicalPersonSourceTable,
): GrowthCanonicalPersonSourceTable | null {
  const idx = sources.indexOf(current)
  if (idx < 0 || idx >= sources.length - 1) return null
  return sources[idx + 1]
}

/** Promote staging contacts for one external company candidate (7.PS-HA-FIX). */
export async function runCanonicalPersonBackfillForCompanyCandidate(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    canonical_company_id?: string | null
    mode: "dry_run" | "apply"
  },
): Promise<{ rows_processed: number; persons_linked: number; errors: number }> {
  const company_candidate_id = input.company_candidate_id.trim()
  if (!company_candidate_id) {
    return { rows_processed: 0, persons_linked: 0, errors: 0 }
  }

  const loaded = await loadCanonicalPersonIndexesFromDb(admin)
  const indexes = buildIndexesFromDb(loaded)
  let rows_processed = 0
  let persons_linked = 0
  let errors = 0

  const { data: candidateRows, error: candidateError } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(selectForPersonSourceTable("contact_candidates"))
    .eq("company_candidate_id", company_candidate_id)
    .is("canonical_person_id", null)
    .order("id", { ascending: true })
    .limit(50)

  if (candidateError) {
    throw new Error(`contact_candidates: ${candidateError.message}`)
  }

  const stats = emptySourceStats()
  for (const row of candidateRows ?? []) {
    const mapped = mapContactCandidateRow(row as Record<string, unknown>)
    if (input.canonical_company_id) {
      mapped.canonical_company_id = input.canonical_company_id
    }
    const outcome = await processCandidate(admin, mapped, indexes, input.mode, stats)
    rows_processed++
    if (!outcome.ok) {
      errors++
      continue
    }
    persons_linked++
  }

  const canonical_company_id =
    (input.canonical_company_id ?? "").trim() ||
    (await fetchStagingCanonicalCompanyId(admin, company_candidate_id))

  if (canonical_company_id) {
    const { data: contactRows, error: contactError } = await admin
      .schema("growth")
      .from("company_contacts")
      .select(selectForPersonSourceTable("company_contacts"))
      .eq("company_id", canonical_company_id)
      .is("canonical_person_id", null)
      .order("id", { ascending: true })
      .limit(50)

    if (contactError) {
      throw new Error(`company_contacts: ${contactError.message}`)
    }

    const contactStats = emptySourceStats()
    for (const row of contactRows ?? []) {
      const mapped = mapCompanyContactRow(row as Record<string, unknown>)
      mapped.canonical_company_id = canonical_company_id
      const outcome = await processCandidate(admin, mapped, indexes, input.mode, contactStats)
      rows_processed++
      if (!outcome.ok) {
        errors++
        continue
      }
      persons_linked++
    }
  }

  return { rows_processed, persons_linked, errors }
}

export async function runCanonicalPersonBackfill(
  admin: SupabaseClient,
  options: {
    mode: "dry_run" | "apply"
    sources?: GrowthCanonicalPersonSourceTable[]
    batchSize?: number
    cursor?: GrowthCanonicalPersonBackfillCursor | null
  },
): Promise<GrowthCanonicalPersonBackfillResult> {
  const mode = options.mode
  const sources = options.sources ?? DEFAULT_SOURCES
  const batchSize = resolveBatchSize(
    options.batchSize ??
      (options.cursor != null ? GROWTH_CANONICAL_PERSON_BACKFILL_DEFAULT_BATCH_SIZE : undefined),
  )

  const existingCount = await countCanonicalPersons(admin)
  const loaded = await loadCanonicalPersonIndexesFromDb(admin)
  const indexes = buildIndexesFromDb(loaded)

  const stats = emptyStats(mode, existingCount)
  stats.unique_normalized_emails = indexes.by_normalized_email.size

  const identityCounts: Record<string, number> = { ...(options.cursor?.identity_counts ?? {}) }
  const error_rows: GrowthCanonicalPersonBackfillErrorRow[] = []

  if (batchSize == null) {
    return runCanonicalPersonBackfillFull(admin, {
      mode,
      sources,
      stats,
      indexes,
      identityCounts,
      existingCount,
      error_rows,
    })
  }

  let table = resolveStartTable(sources, options.cursor)
  let afterId = options.cursor?.after_id ?? null
  let processedInChunk = 0
  let chunkStoppedOnError = false

  while (processedInChunk < batchSize && !chunkStoppedOnError) {
    const remaining = batchSize - processedInChunk
    const rows = await fetchPendingChunk(admin, table, afterId, remaining)
    const leadCompanyMap =
      table === "lead_decision_makers" ? await buildLeadCompanyMap(admin, rows) : new Map()

    for (const row of rows) {
      const rowId = asString(row.id)
      if (!rowId) continue

      const input = mapRow(table, row, leadCompanyMap)
      trackEmail(identityCounts, canonicalNormalizedPersonEmail(input.email))

      const outcome = await processCandidate(admin, input, indexes, mode, stats.sources[table])
      if (!outcome.ok) {
        recordErrorRow(error_rows, table, input.source_id, outcome.error)
        chunkStoppedOnError = true
        break
      }

      processedInChunk++
      afterId = rowId
      if (processedInChunk >= batchSize) break
    }

    if (chunkStoppedOnError) break

    if (rows.length < remaining) {
      const nextTable = nextSourceTable(sources, table)
      if (!nextTable) {
        return finalizeBackfillResult(admin, {
          mode,
          sources,
          stats,
          indexes,
          identityCounts,
          existingCount,
          error_rows,
          progress: {
            batch_size: batchSize,
            processed_in_chunk: processedInChunk,
            current_source_table: table,
          },
          tableWalkComplete: true,
        })
      }
      table = nextTable
      afterId = null
    }
  }

  const pending_by_source = await fetchPendingBySource(admin, countUnlinkedStagingPersonSources)
  const pending_total = sumPendingTotal(pending_by_source)

  stats.merge_groups_by_email = mergeGroupsFromEmailCounts(identityCounts)
  stats.unique_normalized_emails = indexes.by_normalized_email.size
  stats.canonical_persons_after = stats.canonical_persons_existing + totalWouldCreate(stats)

  return {
    stats,
    done: false,
    cursor: {
      source_table: table,
      after_id: afterId,
      identity_counts: identityCounts,
    },
    progress: {
      batch_size: batchSize,
      processed_in_chunk: processedInChunk,
      current_source_table: table,
    },
    pending_by_source,
    pending_total,
    error_rows,
    verification: null,
    certification: null,
  }
}

async function runCanonicalPersonBackfillFull(
  admin: SupabaseClient,
  input: {
    mode: "dry_run" | "apply"
    sources: GrowthCanonicalPersonSourceTable[]
    stats: GrowthCanonicalPersonBackfillStats
    indexes: CanonicalPersonResolverIndexes
    identityCounts: Record<string, number>
    existingCount: number
    error_rows: GrowthCanonicalPersonBackfillErrorRow[]
  },
): Promise<GrowthCanonicalPersonBackfillResult> {
  const { mode, sources, stats, indexes, identityCounts, existingCount, error_rows } = input
  let lastTable = sources[0]
  let resumeAfterId: string | null = null
  let stoppedOnError = false

  for (const table of sources) {
    if (stoppedOnError) break
    lastTable = table
    let afterId: string | null = null
    while (true) {
      const rows = await fetchPendingChunk(admin, table, afterId, 1000)
      if (rows.length === 0) break

      const leadCompanyMap =
        table === "lead_decision_makers" ? await buildLeadCompanyMap(admin, rows) : new Map()

      for (const row of rows) {
        const rowId = asString(row.id)
        if (!rowId) continue

        const inputRow = mapRow(table, row, leadCompanyMap)
        trackEmail(identityCounts, canonicalNormalizedPersonEmail(inputRow.email))

        const outcome = await processCandidate(admin, inputRow, indexes, mode, stats.sources[table])
        if (!outcome.ok) {
          recordErrorRow(error_rows, table, inputRow.source_id, outcome.error)
          stoppedOnError = true
          resumeAfterId = afterId
          break
        }
        afterId = rowId
        resumeAfterId = rowId
      }

      if (stoppedOnError) break
      if (rows.length < 1000) break
    }
  }

  if (stoppedOnError) {
    const pending_by_source = await fetchPendingBySource(admin, countUnlinkedStagingPersonSources)
    return {
      stats,
      done: false,
      cursor: {
        source_table: lastTable,
        after_id: resumeAfterId,
        identity_counts: identityCounts,
      },
      progress: {
        batch_size: 0,
        processed_in_chunk: Object.values(stats.sources).reduce((n, s) => n + s.rows_processed, 0),
        current_source_table: lastTable,
      },
      pending_by_source,
      pending_total: sumPendingTotal(pending_by_source),
      error_rows,
      verification: null,
      certification: null,
    }
  }

  return finalizeBackfillResult(admin, {
    mode,
    sources,
    stats,
    indexes,
    identityCounts,
    existingCount,
    error_rows,
    progress: {
      batch_size: 0,
      processed_in_chunk: Object.values(stats.sources).reduce((n, s) => n + s.rows_processed, 0),
      current_source_table: lastTable,
    },
    tableWalkComplete: true,
  })
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}
