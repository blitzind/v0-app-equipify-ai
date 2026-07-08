import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SIGNAL_BLOCKED_ACTIONS,
  GROWTH_SIGNAL_SAFE_ACTIONS,
  type GrowthSignalSafeAction,
} from "@/lib/growth/signals/signal-watchlist-types"
import {
  isGrowthSignalWatchlistSchemaReady,
  GROWTH_SIGNAL_WATCHLIST_SCHEMA_SETUP_MESSAGE,
} from "@/lib/growth/signals/signal-watchlist-schema-health"
import {
  isGrowthSignalFoundationSchemaReady,
  GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE,
} from "@/lib/growth/signals/signal-schema-health"
import { stripInternalSignalFields } from "@/lib/growth/signals/signal-api-sanitize"
import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import { GROWTH_SIGNAL_WATCHLISTS_QA_MARKER } from "@/lib/growth/signals/signal-watchlist-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function mapSignalRow(row: Record<string, unknown>): GrowthSignalRow {
  return stripInternalSignalFields({
    id: asString(row.id),
    organization_id: typeof row.organization_id === "string" ? row.organization_id : null,
    signal_type: asString(row.signal_type) as GrowthSignalRow["signal_type"],
    provider_key: asString(row.provider_key),
    provider_event_id: typeof row.provider_event_id === "string" ? row.provider_event_id : null,
    dedupe_hash: asString(row.dedupe_hash),
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    signal_score: typeof row.signal_score === "number" ? row.signal_score : 0,
    urgency: asString(row.urgency) as GrowthSignalRow["urgency"],
    routing_priority: typeof row.routing_priority === "number" ? row.routing_priority : 0,
    occurred_at: asString(row.occurred_at),
    detected_at: asString(row.detected_at),
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
    company_id: typeof row.company_id === "string" ? row.company_id : null,
    company_name: asString(row.company_name),
    domain: typeof row.domain === "string" ? row.domain : null,
    contact_id: typeof row.contact_id === "string" ? row.contact_id : null,
    contact_display_label:
      typeof row.contact_display_label === "string" ? row.contact_display_label : null,
    title: typeof row.title === "string" ? row.title : null,
    previous_title: typeof row.previous_title === "string" ? row.previous_title : null,
    seniority: typeof row.seniority === "string" ? row.seniority : null,
    geography: typeof row.geography === "string" ? row.geography : null,
    industry: typeof row.industry === "string" ? row.industry : null,
    category: typeof row.category === "string" ? row.category : null,
    evidence_summary: asString(row.evidence_summary),
    workflow_state: asString(row.workflow_state) as GrowthSignalRow["workflow_state"],
    suppression_state: asString(row.suppression_state) as GrowthSignalRow["suppression_state"],
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
  })
}

export function isGrowthSignalSafeAction(action: string): action is GrowthSignalSafeAction {
  return (GROWTH_SIGNAL_SAFE_ACTIONS as readonly string[]).includes(action)
}

export function isGrowthSignalBlockedAction(action: string): boolean {
  return (GROWTH_SIGNAL_BLOCKED_ACTIONS as readonly string[]).includes(action)
}

export type ApplyGrowthSignalActionResult = {
  ok: boolean
  qa_marker: typeof GROWTH_SIGNAL_WATCHLISTS_QA_MARKER
  action?: GrowthSignalSafeAction
  signal?: GrowthSignalRow
  watchlist_id?: string
  message?: string
  error?: string
}

export async function applyGrowthSignalAction(
  admin: SupabaseClient,
  input: {
    signal_id: string
    action: string
    watchlist_id?: string | null
    userId?: string | null
  },
): Promise<ApplyGrowthSignalActionResult> {
  const base = { qa_marker: GROWTH_SIGNAL_WATCHLISTS_QA_MARKER } as const

  if (isGrowthSignalBlockedAction(input.action)) {
    return {
      ...base,
      ok: false,
      error: "blocked_action",
      message: `Action "${input.action}" is not enabled — autonomous outreach and sequence enrollment are disabled.`,
    }
  }

  if (!isGrowthSignalSafeAction(input.action)) {
    return {
      ...base,
      ok: false,
      error: "unsupported_action",
      message: `Unsupported action "${input.action}".`,
    }
  }

  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ...base, ok: false, error: "schema_not_ready", message: GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE }
  }

  const signalId = input.signal_id.trim()
  if (!signalId) {
    return { ...base, ok: false, error: "validation_error", message: "Signal id is required." }
  }

  if (input.action === "add_to_watchlist") {
    const watchlistId = input.watchlist_id?.trim()
    if (!watchlistId) {
      return { ...base, ok: false, error: "validation_error", message: "watchlist_id is required for add_to_watchlist." }
    }
    if (!(await isGrowthSignalWatchlistSchemaReady(admin))) {
      return { ...base, ok: false, error: "schema_not_ready", message: GROWTH_SIGNAL_WATCHLIST_SCHEMA_SETUP_MESSAGE }
    }

    const { data: watchlist, error: watchlistError } = await admin
      .schema("growth")
      .from("signal_watchlists")
      .select("id, organization_id, archived_at")
      .eq("id", watchlistId)
      .maybeSingle()
    if (watchlistError) return { ...base, ok: false, error: "db_error", message: watchlistError.message }
    if (!watchlist || watchlist.archived_at) {
      return { ...base, ok: false, error: "not_found", message: "Watchlist not found." }
    }

    const { data: signal, error: signalError } = await admin
      .schema("growth")
      .from("signals")
      .select("id, organization_id")
      .eq("id", signalId)
      .maybeSingle()
    if (signalError) return { ...base, ok: false, error: "db_error", message: signalError.message }
    if (!signal) return { ...base, ok: false, error: "not_found", message: "Signal not found." }

    const { error: matchError } = await admin.schema("growth").from("signal_watchlist_matches").upsert(
      {
        watchlist_id: watchlistId,
        signal_id: signalId,
        organization_id: (signal.organization_id as string | null) ?? (watchlist.organization_id as string | null) ?? null,
        matched_at: new Date().toISOString(),
        match_reason: { manual: true, added_by: input.userId ?? null },
      },
      { onConflict: "watchlist_id,signal_id" },
    )
    if (matchError) return { ...base, ok: false, error: "db_error", message: matchError.message }

    await admin
      .schema("growth")
      .from("signal_watchlists")
      .update({ match_count: await countWatchlistMatches(admin, watchlistId) })
      .eq("id", watchlistId)

    const updated = await loadSignalForAction(admin, signalId)
    return {
      ...base,
      ok: true,
      action: input.action,
      watchlist_id: watchlistId,
      signal: updated ?? undefined,
      message: "Signal added to watchlist.",
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.action === "suppress") {
    patch.suppression_state = "suppressed"
    patch.workflow_state = "suppressed"
  } else if (input.action === "dismiss") {
    patch.suppression_state = "dismissed"
  } else if (input.action === "mark_reviewed") {
    patch.workflow_state = "reviewed"
  }

  const { data, error } = await admin
    .schema("growth")
    .from("signals")
    .update(patch)
    .eq("id", signalId)
    .select(
      "id, organization_id, signal_type, provider_key, provider_event_id, dedupe_hash, confidence, signal_score, urgency, routing_priority, occurred_at, detected_at, expires_at, company_id, company_name, domain, contact_id, contact_display_label, title, previous_title, seniority, geography, industry, category, evidence_summary, workflow_state, suppression_state, created_at, updated_at, metadata",
    )
    .maybeSingle()

  if (error) return { ...base, ok: false, error: "db_error", message: error.message }
  if (!data) return { ...base, ok: false, error: "not_found", message: "Signal not found." }

  await admin.schema("growth").from("signal_events").insert({
    signal_id: signalId,
    organization_id: (data.organization_id as string | null) ?? null,
    event_type: input.action === "suppress" ? "suppressed" : "scored",
    event_payload: { action: input.action, operator_id: input.userId ?? null },
  })

  return {
    ...base,
    ok: true,
    action: input.action,
    signal: mapSignalRow(data as Record<string, unknown>),
    message:
      input.action === "mark_reviewed"
        ? "Signal marked reviewed."
        : input.action === "dismiss"
          ? "Signal dismissed."
          : "Signal suppressed.",
  }
}

async function countWatchlistMatches(admin: SupabaseClient, watchlistId: string): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("signal_watchlist_matches")
    .select("id", { count: "exact", head: true })
    .eq("watchlist_id", watchlistId)
  if (error) return 0
  return count ?? 0
}

async function loadSignalForAction(admin: SupabaseClient, signalId: string): Promise<GrowthSignalRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("signals")
    .select(
      "id, organization_id, signal_type, provider_key, provider_event_id, dedupe_hash, confidence, signal_score, urgency, routing_priority, occurred_at, detected_at, expires_at, company_id, company_name, domain, contact_id, contact_display_label, title, previous_title, seniority, geography, industry, category, evidence_summary, workflow_state, suppression_state, created_at, updated_at, metadata",
    )
    .eq("id", signalId)
    .maybeSingle()
  if (error || !data) return null
  return mapSignalRow(data as Record<string, unknown>)
}
