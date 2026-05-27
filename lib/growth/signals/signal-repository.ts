import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { attachSignalDedupeHash, buildDerivedHireDedupeHash, buildSignalEvidenceDedupeHash, GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY } from "@/lib/growth/signals/signal-dedupe"
import {
  aggregateJobPostingsToHiringVelocity,
  buildDerivedHireSignalDraft,
} from "@/lib/growth/signals/hiring-velocity"
import {
  buildSignalEvidenceSummary,
  validateSignalEvidenceRequired,
} from "@/lib/growth/signals/signal-evidence"
import { scoreSignalV1 } from "@/lib/growth/signals/signal-scoring-engine"
import {
  GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE,
  isGrowthSignalFoundationSchemaReady,
} from "@/lib/growth/signals/signal-schema-health"
import { stripInternalSignalFields } from "@/lib/growth/signals/signal-api-sanitize"
import { stripInternalPersonMetadata, readPersonSignalMetadata } from "@/lib/growth/signals/person-signal-metadata"
import { signalMatchesWatchlistFilters } from "@/lib/growth/signals/signal-trigger-evaluator"
import { getGrowthSignalWatchlist } from "@/lib/growth/signals/signal-watchlist-repository"
import {
  GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
  type GrowthNormalizedSignalDraft,
  type GrowthSignalDetailRow,
  type GrowthSignalEventRow,
  type GrowthSignalListFilters,
  type GrowthSignalListResult,
  type GrowthSignalRow,
  type GrowthSignalSourceRow,
  type GrowthSignalTargetRow,
  type GrowthSignalType,
  type GrowthSignalUrgency,
  type GrowthSignalWorkflowState,
} from "@/lib/growth/signals/signal-types"

export { stripInternalSignalFields } from "@/lib/growth/signals/signal-api-sanitize"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNullableString(value: unknown): string | null {
  const text = asString(value)
  return text || null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function parseMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function mapSignalRow(row: Record<string, unknown>): GrowthSignalRow {
  const mapped = stripInternalSignalFields({
    id: asString(row.id),
    organization_id: asNullableString(row.organization_id),
    signal_type: asString(row.signal_type) as GrowthSignalType,
    provider_key: asString(row.provider_key),
    provider_event_id: asNullableString(row.provider_event_id),
    dedupe_hash: asString(row.dedupe_hash),
    confidence: asNumber(row.confidence),
    signal_score: asNumber(row.signal_score),
    urgency: asString(row.urgency) as GrowthSignalUrgency,
    routing_priority: asNumber(row.routing_priority),
    occurred_at: asString(row.occurred_at),
    detected_at: asString(row.detected_at),
    expires_at: asNullableString(row.expires_at),
    company_id: asNullableString(row.company_id),
    company_name: asString(row.company_name),
    domain: asNullableString(row.domain),
    contact_id: asNullableString(row.contact_id),
    contact_display_label: asNullableString(row.contact_display_label),
    title: asNullableString(row.title),
    previous_title: asNullableString(row.previous_title),
    seniority: asNullableString(row.seniority),
    geography: asNullableString(row.geography),
    industry: asNullableString(row.industry),
    category: asNullableString(row.category),
    evidence_summary: asString(row.evidence_summary),
    workflow_state: asString(row.workflow_state) as GrowthSignalWorkflowState,
    suppression_state: asString(row.suppression_state) as GrowthSignalRow["suppression_state"],
    processed_to_lead_inbox: row.processed_to_lead_inbox === true,
    lead_inbox_id: asNullableString(row.lead_inbox_id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    metadata: parseMetadata(row.metadata),
  })
  mapped.metadata = stripInternalPersonMetadata(mapped.metadata)
  return mapped
}

function mapSourceRow(row: Record<string, unknown>): GrowthSignalSourceRow {
  return {
    id: asString(row.id),
    source_type: asString(row.source_type) as GrowthSignalSourceRow["source_type"],
    source_label: asString(row.source_label),
    source_url: asNullableString(row.source_url),
    publisher: asNullableString(row.publisher),
    excerpt: asString(row.excerpt),
    observed_at: asString(row.observed_at),
    confidence_score: asNumber(row.confidence_score),
  }
}

function mapTargetRow(row: Record<string, unknown>): GrowthSignalTargetRow {
  return {
    id: asString(row.id),
    target_kind: asString(row.target_kind) as GrowthSignalTargetRow["target_kind"],
    target_ref: asString(row.target_ref),
    target_label: asString(row.target_label),
  }
}

function mapEventRow(row: Record<string, unknown>): GrowthSignalEventRow {
  return {
    id: asString(row.id),
    event_type: asString(row.event_type) as GrowthSignalEventRow["event_type"],
    occurred_at: asString(row.occurred_at),
  }
}

function readHiringIntensity(metadata: Record<string, unknown> | undefined): string | null {
  const velocity = metadata?.hiring_velocity
  if (!velocity || typeof velocity !== "object") return null
  const intensity = (velocity as Record<string, unknown>).hiring_intensity
  return typeof intensity === "string" && intensity.trim() ? intensity.trim() : null
}

function applyClientSideSignalFilters(
  items: GrowthSignalRow[],
  filters: GrowthSignalListFilters,
): GrowthSignalRow[] {
  return items.filter((signal) => {
    if (filters.minimum_signal_score != null && signal.signal_score < filters.minimum_signal_score) {
      return false
    }
    if (filters.suppression_state && signal.suppression_state !== filters.suppression_state) {
      return false
    }
    if (filters.department) {
      const dept = signal.category?.trim() || ""
      if (!dept.toLowerCase().includes(filters.department.toLowerCase())) return false
    }
    if (filters.hiring_intensity) {
      const intensity = readHiringIntensity(signal.metadata)
      if (!intensity || intensity.toLowerCase() !== filters.hiring_intensity.toLowerCase()) return false
    }
    if (filters.geography) {
      const geo = signal.geography?.trim() || ""
      if (!geo.toLowerCase().includes(filters.geography.toLowerCase())) return false
    }
    if (filters.seniority && signal.seniority?.toLowerCase() !== filters.seniority.toLowerCase()) {
      return false
    }
    const personMeta = readPersonSignalMetadata(signal)
    if (filters.transition_type && personMeta.transition_type !== filters.transition_type) {
      return false
    }
    if (
      filters.identity_confidence_min != null &&
      (personMeta.identity_confidence ?? 0) < filters.identity_confidence_min
    ) {
      return false
    }
    if (
      filters.previous_company_domain &&
      !(personMeta.previous_company_domain ?? "")
        .toLowerCase()
        .includes(filters.previous_company_domain.toLowerCase())
    ) {
      return false
    }
    return true
  })
}

async function mergeWatchlistFilters(
  admin: SupabaseClient,
  filters: GrowthSignalListFilters,
): Promise<GrowthSignalListFilters | null> {
  const watchlistId = filters.watchlist_id?.trim()
  if (!watchlistId) return filters

  const watchlist = await getGrowthSignalWatchlist(admin, watchlistId)
  if (!watchlist || watchlist.archived_at) return null

  const wf = watchlist.filters
  const allowedTypes =
    watchlist.signal_types.length > 0 ? watchlist.signal_types : wf.signal_types ?? []

  if (filters.signal_type && allowedTypes.length > 0 && !allowedTypes.includes(filters.signal_type)) {
    return { ...filters, watchlist_id: watchlistId, signal_type: filters.signal_type }
  }

  return {
    ...filters,
    watchlist_id: watchlistId,
    signal_type: filters.signal_type,
    workflow_state: filters.workflow_state ?? wf.workflow_state ?? undefined,
    suppression_state: filters.suppression_state ?? wf.suppression_state ?? undefined,
    urgency: filters.urgency ?? (wf.urgency as GrowthSignalUrgency | null) ?? undefined,
    company: filters.company ?? wf.company ?? undefined,
    domain: filters.domain ?? wf.domain ?? undefined,
    category: filters.category ?? wf.category ?? undefined,
    department: filters.department ?? wf.department ?? undefined,
    hiring_intensity: filters.hiring_intensity ?? wf.hiring_intensity ?? undefined,
    minimum_signal_score: filters.minimum_signal_score ?? wf.minimum_signal_score ?? undefined,
    geography: filters.geography ?? wf.geography ?? undefined,
    seniority: filters.seniority ?? wf.seniority ?? undefined,
    transition_type: filters.transition_type ?? wf.transition_type ?? undefined,
    identity_confidence_min:
      filters.identity_confidence_min ?? wf.identity_confidence_min ?? undefined,
    previous_company_domain:
      filters.previous_company_domain ?? wf.previous_company_domain ?? undefined,
    occurred_from: filters.occurred_from ?? wf.occurred_from ?? undefined,
    occurred_to: filters.occurred_to ?? wf.occurred_to ?? undefined,
  }
}

export async function loadGrowthSignals(
  admin: SupabaseClient,
  filters: GrowthSignalListFilters = {},
): Promise<GrowthSignalListResult> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return {
      qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
      items: [],
      total: 0,
    }
  }

  const merged = await mergeWatchlistFilters(admin, filters)
  if (merged === null) {
    return {
      qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
      items: [],
      total: 0,
    }
  }

  if (merged.watchlist_id) {
    const watchlist = await getGrowthSignalWatchlist(admin, merged.watchlist_id)
    if (watchlist) {
      const allowedTypes =
        watchlist.signal_types.length > 0
          ? watchlist.signal_types
          : watchlist.filters.signal_types ?? []
      if (merged.signal_type && allowedTypes.length > 0 && !allowedTypes.includes(merged.signal_type)) {
        return {
          qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
          items: [],
          total: 0,
        }
      }
    }
  }

  const effectiveFilters = merged
  const limit = Math.min(Math.max(effectiveFilters.limit ?? 50, 1), 200)
  const offset = Math.max(effectiveFilters.offset ?? 0, 0)
  const needsClientFilter =
    effectiveFilters.minimum_signal_score != null ||
    effectiveFilters.suppression_state != null ||
    effectiveFilters.department != null ||
    effectiveFilters.hiring_intensity != null ||
    effectiveFilters.geography != null ||
    effectiveFilters.seniority != null ||
    effectiveFilters.transition_type != null ||
    effectiveFilters.identity_confidence_min != null ||
    effectiveFilters.previous_company_domain != null ||
    Boolean(effectiveFilters.watchlist_id)

  let query = admin
    .schema("growth")
    .from("signals")
    .select(
      "id, organization_id, signal_type, provider_key, provider_event_id, dedupe_hash, confidence, signal_score, urgency, routing_priority, occurred_at, detected_at, expires_at, company_id, company_name, domain, contact_id, contact_display_label, title, previous_title, seniority, geography, industry, category, evidence_summary, workflow_state, suppression_state, processed_to_lead_inbox, lead_inbox_id, created_at, updated_at, metadata",
      { count: "exact" },
    )
    .order("occurred_at", { ascending: false })

  if (!needsClientFilter) {
    query = query.range(offset, offset + limit - 1)
  } else {
    query = query.limit(2000)
  }

  if (effectiveFilters.signal_type) query = query.eq("signal_type", effectiveFilters.signal_type)
  if (effectiveFilters.workflow_state) query = query.eq("workflow_state", effectiveFilters.workflow_state)
  if (effectiveFilters.urgency) query = query.eq("urgency", effectiveFilters.urgency)
  if (effectiveFilters.organization_id) query = query.eq("organization_id", effectiveFilters.organization_id)
  if (effectiveFilters.company) query = query.ilike("company_name", `%${effectiveFilters.company}%`)
  if (effectiveFilters.company_id) query = query.eq("company_id", effectiveFilters.company_id)
  if (effectiveFilters.domain) query = query.ilike("domain", `%${effectiveFilters.domain}%`)
  if (effectiveFilters.occurred_from) query = query.gte("occurred_at", effectiveFilters.occurred_from)
  if (effectiveFilters.occurred_to) query = query.lte("occurred_at", effectiveFilters.occurred_to)
  if (effectiveFilters.category) query = query.eq("category", effectiveFilters.category)
  if (effectiveFilters.seniority) query = query.eq("seniority", effectiveFilters.seniority)

  if (effectiveFilters.publisher) {
    const { data: sourceMatches, error: sourceError } = await admin
      .schema("growth")
      .from("signal_sources")
      .select("signal_id")
      .or(`publisher.ilike.%${effectiveFilters.publisher}%,source_label.ilike.%${effectiveFilters.publisher}%`)
    if (sourceError) throw new Error(sourceError.message)
    const signalIds = [...new Set((sourceMatches ?? []).map((row) => asString(row.signal_id)).filter(Boolean))]
    if (signalIds.length === 0) {
      return {
        qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
        items: [],
        total: 0,
      }
    }
    query = query.in("id", signalIds)
  }

  const { data, error, count } = await query
  if (error) {
    throw new Error(error.message)
  }

  let items = (data ?? []).map((row) => mapSignalRow(row as Record<string, unknown>))

  if (needsClientFilter) {
    items = applyClientSideSignalFilters(items, effectiveFilters)
    if (effectiveFilters.watchlist_id) {
      const watchlist = await getGrowthSignalWatchlist(admin, effectiveFilters.watchlist_id)
      if (watchlist) {
        items = items.filter((signal) => signalMatchesWatchlistFilters(signal, watchlist).matched)
      }
    }
    const total = items.length
    items = items.slice(offset, offset + limit)
    return {
      qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
      items,
      total,
    }
  }

  return {
    qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
    items,
    total: count ?? 0,
  }
}

export async function loadGrowthSignalById(
  admin: SupabaseClient,
  signalId: string,
): Promise<GrowthSignalDetailRow | null> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return null
  }

  const { data: signal, error } = await admin
    .schema("growth")
    .from("signals")
    .select(
      "id, organization_id, signal_type, provider_key, provider_event_id, dedupe_hash, confidence, signal_score, urgency, routing_priority, occurred_at, detected_at, expires_at, company_id, company_name, domain, contact_id, contact_display_label, title, previous_title, seniority, geography, industry, category, evidence_summary, workflow_state, suppression_state, processed_to_lead_inbox, lead_inbox_id, created_at, updated_at, metadata",
    )
    .eq("id", signalId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!signal) return null

  const [sourcesResult, targetsResult, eventsResult] = await Promise.all([
    admin
      .schema("growth")
      .from("signal_sources")
      .select(
        "id, source_type, source_label, source_url, publisher, excerpt, observed_at, confidence_score",
      )
      .eq("signal_id", signalId)
      .order("observed_at", { ascending: false }),
    admin
      .schema("growth")
      .from("signal_targets")
      .select("id, target_kind, target_ref, target_label")
      .eq("signal_id", signalId),
    admin
      .schema("growth")
      .from("signal_events")
      .select("id, event_type, occurred_at")
      .eq("signal_id", signalId)
      .order("occurred_at", { ascending: false })
      .limit(20),
  ])

  if (sourcesResult.error) throw new Error(sourcesResult.error.message)
  if (targetsResult.error) throw new Error(targetsResult.error.message)
  if (eventsResult.error) throw new Error(eventsResult.error.message)

  return {
    ...mapSignalRow(signal as Record<string, unknown>),
    sources: (sourcesResult.data ?? []).map((row) => mapSourceRow(row as Record<string, unknown>)),
    targets: (targetsResult.data ?? []).map((row) => mapTargetRow(row as Record<string, unknown>)),
    events: (eventsResult.data ?? []).map((row) => mapEventRow(row as Record<string, unknown>)),
  }
}

export type PersistGrowthSignalResult = {
  ok: boolean
  signal_id?: string
  duplicate?: boolean
  reason?: string
}

export async function persistGrowthSignalDraft(
  admin: SupabaseClient,
  draft: GrowthNormalizedSignalDraft,
): Promise<PersistGrowthSignalResult> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, reason: GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE }
  }

  const evidenceError = validateSignalEvidenceRequired(draft)
  if (evidenceError) {
    await recordSignalEvent(admin, {
      event_type: "rejected_no_evidence",
      organization_id: draft.organization_id ?? null,
      payload: { reason: evidenceError, provider_key: draft.provider_key },
    })
    return { ok: false, reason: evidenceError }
  }

  const dedupe_hash = attachSignalDedupeHash(draft)
  let duplicateQuery = admin
    .schema("growth")
    .from("signals")
    .select("id")
    .eq("signal_type", draft.signal_type)
    .eq("dedupe_hash", dedupe_hash)

  duplicateQuery =
    draft.organization_id != null
      ? duplicateQuery.eq("organization_id", draft.organization_id)
      : duplicateQuery.is("organization_id", null)

  const duplicate = await duplicateQuery.maybeSingle()

  if (duplicate.data?.id) {
    await recordSignalEvent(admin, {
      signal_id: asString(duplicate.data.id),
      event_type: "rejected_duplicate",
      organization_id: draft.organization_id ?? null,
      payload: { dedupe_hash },
    })
    return { ok: false, duplicate: true, signal_id: asString(duplicate.data.id), reason: "duplicate" }
  }

  const scoring = scoreSignalV1(draft)
  const evidence_summary = buildSignalEvidenceSummary(draft)
  let raw_payload_ref: string | null = null

  if (draft.raw_payload !== undefined) {
    const { data: rawRow, error: rawError } = await admin
      .schema("growth")
      .from("signal_raw_payloads")
      .insert({
        organization_id: draft.organization_id ?? null,
        provider_key: draft.provider_key,
        provider_event_id: draft.provider_event_id ?? null,
        payload: draft.raw_payload as Record<string, unknown>,
      })
      .select("id")
      .single()
    if (rawError) {
      return { ok: false, reason: rawError.message }
    }
    raw_payload_ref = asString(rawRow?.id) || null
  }

  const { data: inserted, error: insertError } = await admin
    .schema("growth")
    .from("signals")
    .insert({
      organization_id: draft.organization_id ?? null,
      signal_type: draft.signal_type,
      provider_key: draft.provider_key,
      provider_event_id: draft.provider_event_id ?? null,
      dedupe_hash,
      confidence: scoring.confidence,
      signal_score: scoring.signal_score,
      urgency: scoring.urgency,
      routing_priority: scoring.routing_priority,
      occurred_at: draft.occurred_at,
      detected_at: draft.detected_at ?? new Date().toISOString(),
      expires_at: draft.expires_at ?? null,
      company_id: draft.company_id ?? null,
      company_name: draft.company_name ?? "",
      domain: draft.domain ?? null,
      contact_id: draft.contact_id ?? null,
      contact_display_label: draft.contact_display_label ?? null,
      title: draft.title ?? null,
      previous_title: draft.previous_title ?? null,
      seniority: draft.seniority ?? null,
      geography: draft.geography ?? null,
      industry: draft.industry ?? null,
      category: draft.category ?? null,
      evidence_summary,
      enrichment_metadata: {},
      workflow_state: "new",
      suppression_state: "active",
      scoring_metadata: scoring.scoring_metadata,
      raw_payload_ref,
      metadata: draft.metadata ?? {},
    })
    .select("id")
    .single()

  if (insertError || !inserted?.id) {
    return { ok: false, reason: insertError?.message ?? "insert_failed" }
  }

  const signalId = asString(inserted.id)

  const sourceRows = draft.evidence.map((entry) => ({
    signal_id: signalId,
    organization_id: draft.organization_id ?? null,
    source_type: entry.source_type,
    source_label: entry.source_label ?? draft.provider_key,
    source_url: entry.source_url ?? null,
    publisher: entry.publisher ?? null,
    excerpt: entry.excerpt,
    observed_at: entry.observed_at ?? draft.occurred_at,
    confidence_score: entry.confidence_score ?? scoring.confidence,
    dedupe_hash: buildSignalEvidenceDedupeHash(signalId, entry),
    metadata: entry.metadata ?? {},
  }))

  const { error: sourceError } = await admin.schema("growth").from("signal_sources").insert(sourceRows)
  if (sourceError) {
    return { ok: false, reason: sourceError.message }
  }

  if (draft.targets?.length) {
    const targetRows = draft.targets.map((target) => ({
      signal_id: signalId,
      organization_id: draft.organization_id ?? null,
      target_kind: target.target_kind,
      target_ref: target.target_ref,
      target_label: target.target_label ?? target.target_ref,
      metadata: target.metadata ?? {},
    }))
    const { error: targetError } = await admin.schema("growth").from("signal_targets").insert(targetRows)
    if (targetError) {
      return { ok: false, reason: targetError.message }
    }
  } else if (draft.domain) {
    await admin.schema("growth").from("signal_targets").insert({
      signal_id: signalId,
      organization_id: draft.organization_id ?? null,
      target_kind: "domain",
      target_ref: draft.domain,
      target_label: draft.domain,
    })
  }

  await recordSignalEvent(admin, {
    signal_id: signalId,
    event_type: "ingested",
    organization_id: draft.organization_id ?? null,
    payload: {
      provider_key: draft.provider_key,
      signal_type: draft.signal_type,
      dedupe_hash,
    },
  })

  await recordSignalEvent(admin, {
    signal_id: signalId,
    event_type: "scored",
    organization_id: draft.organization_id ?? null,
    payload: scoring.scoring_metadata,
  })

  return { ok: true, signal_id: signalId }
}

async function recordSignalEvent(
  admin: SupabaseClient,
  input: {
    signal_id?: string | null
    organization_id?: string | null
    event_type: GrowthSignalEventRow["event_type"]
    payload?: Record<string, unknown>
  },
): Promise<void> {
  await admin.schema("growth").from("signal_events").insert({
    signal_id: input.signal_id ?? null,
    organization_id: input.organization_id ?? null,
    event_type: input.event_type,
    event_payload: input.payload ?? {},
  })
}

export async function enqueueSignalIngestionJob(
  admin: SupabaseClient,
  input: {
    provider_key: string
    organization_id?: string | null
    cursor?: Record<string, unknown>
    scheduled_for?: string
  },
): Promise<{ ok: boolean; queue_id?: string; reason?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, reason: GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE }
  }

  const { data, error } = await admin
    .schema("growth")
    .from("signal_ingestion_queue")
    .insert({
      provider_key: input.provider_key,
      organization_id: input.organization_id ?? null,
      cursor: input.cursor ?? {},
      scheduled_for: input.scheduled_for ?? new Date().toISOString(),
      status: "pending",
    })
    .select("id")
    .single()

  if (error) return { ok: false, reason: error.message }
  return { ok: true, queue_id: asString(data?.id) }
}

export type SyncDerivedHiringSignalsResult = {
  upserted: number
  skipped: number
  errors: string[]
}

async function upsertDerivedHireSignalDraft(
  admin: SupabaseClient,
  draft: GrowthNormalizedSignalDraft,
): Promise<PersistGrowthSignalResult> {
  const evidenceError = validateSignalEvidenceRequired(draft)
  if (evidenceError) {
    return { ok: false, reason: evidenceError }
  }

  const dedupe_hash = buildDerivedHireDedupeHash({
    organization_id: draft.organization_id,
    domain: draft.domain,
    company_name: draft.company_name,
  })

  let existingQuery = admin
    .schema("growth")
    .from("signals")
    .select("id")
    .eq("signal_type", "hire")
    .eq("provider_key", GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY)
    .eq("dedupe_hash", dedupe_hash)

  existingQuery =
    draft.organization_id != null
      ? existingQuery.eq("organization_id", draft.organization_id)
      : existingQuery.is("organization_id", null)

  const existing = await existingQuery.maybeSingle()
  const scoring = scoreSignalV1(draft)
  const evidence_summary = buildSignalEvidenceSummary(draft)

  if (existing.data?.id) {
    const signalId = asString(existing.data.id)
    const { error: updateError } = await admin
      .schema("growth")
      .from("signals")
      .update({
        occurred_at: draft.occurred_at,
        company_name: draft.company_name ?? "",
        domain: draft.domain ?? null,
        geography: draft.geography ?? null,
        category: draft.category ?? null,
        title: draft.title ?? null,
        evidence_summary,
        confidence: scoring.confidence,
        signal_score: scoring.signal_score,
        urgency: scoring.urgency,
        routing_priority: scoring.routing_priority,
        scoring_metadata: scoring.scoring_metadata,
        metadata: draft.metadata ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", signalId)

    if (updateError) return { ok: false, reason: updateError.message }

    await admin.schema("growth").from("signal_sources").delete().eq("signal_id", signalId)
    const sourceRows = draft.evidence.map((entry) => ({
      signal_id: signalId,
      organization_id: draft.organization_id ?? null,
      source_type: entry.source_type,
      source_label: entry.source_label ?? draft.provider_key,
      source_url: entry.source_url ?? null,
      publisher: entry.publisher ?? null,
      excerpt: entry.excerpt,
      observed_at: entry.observed_at ?? draft.occurred_at,
      confidence_score: entry.confidence_score ?? scoring.confidence,
      dedupe_hash: buildSignalEvidenceDedupeHash(signalId, entry),
      metadata: entry.metadata ?? {},
    }))
    const { error: sourceError } = await admin.schema("growth").from("signal_sources").insert(sourceRows)
    if (sourceError) return { ok: false, reason: sourceError.message }

    await recordSignalEvent(admin, {
      signal_id: signalId,
      event_type: "scored",
      organization_id: draft.organization_id ?? null,
      payload: { ...scoring.scoring_metadata, derived_sync: true },
    })

    return { ok: true, signal_id: signalId }
  }

  const draftWithDedupe: GrowthNormalizedSignalDraft = {
    ...draft,
    provider_event_id: draft.provider_event_id ?? dedupe_hash.slice(0, 20),
  }
  return persistGrowthSignalDraft(admin, {
    ...draftWithDedupe,
    provider_key: GROWTH_HIRING_VELOCITY_DERIVED_PROVIDER_KEY,
  })
}

export async function syncDerivedHiringSignals(
  admin: SupabaseClient,
  organization_id?: string | null,
): Promise<SyncDerivedHiringSignalsResult> {
  const result: SyncDerivedHiringSignalsResult = { upserted: 0, skipped: 0, errors: [] }

  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    result.errors.push(GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE)
    return result
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  let query = admin
    .schema("growth")
    .from("signals")
    .select(
      "id, organization_id, signal_type, provider_key, provider_event_id, dedupe_hash, confidence, signal_score, urgency, routing_priority, occurred_at, detected_at, expires_at, company_id, company_name, domain, contact_id, contact_display_label, title, previous_title, seniority, geography, industry, category, evidence_summary, workflow_state, suppression_state, processed_to_lead_inbox, lead_inbox_id, created_at, updated_at, metadata",
    )
    .eq("signal_type", "job_posting")
    .gte("occurred_at", cutoff)
    .order("occurred_at", { ascending: false })
    .limit(500)

  if (organization_id) {
    query = query.eq("organization_id", organization_id)
  }

  const { data, error } = await query
  if (error) {
    result.errors.push(error.message)
    return result
  }

  const jobPostings = (data ?? []).map((row) => mapSignalRow(row as Record<string, unknown>))
  const aggregates = aggregateJobPostingsToHiringVelocity(jobPostings)

  for (const aggregate of aggregates) {
    const draft = buildDerivedHireSignalDraft(aggregate)
    const persisted = await upsertDerivedHireSignalDraft(admin, draft)
    if (persisted.ok) {
      result.upserted += 1
    } else {
      result.skipped += 1
      if (persisted.reason) result.errors.push(persisted.reason)
    }
  }

  return result
}
