import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { GrowthLead } from "@/lib/growth/types"
import {
  GROWTH_LEAD_RESEARCH_CACHE_TTL_MS,
} from "@/lib/growth/research-input-hash"
import { GROWTH_LEAD_FIT_MODEL_VERSION } from "@/lib/growth/research-schema"
import type {
  GrowthLeadResearchNotes,
  GrowthLeadResearchResult,
  GrowthLeadResearchRun,
  GrowthLeadResearchRunStatus,
} from "@/lib/growth/research-types"

const RUN_SELECT =
  "id, lead_id, status, trigger_kind, website_url, website_fetch_status, website_text_excerpt, source_urls, result, research_confidence, equipify_fit_score, model_task, model_provider, model_name, error_code, error_message, duration_ms, input_hash, created_by, created_at, finished_at"

type ResearchRunDbRow = {
  id: string
  lead_id: string
  status: string
  trigger_kind: string
  website_url: string | null
  website_fetch_status: string
  website_text_excerpt: string | null
  source_urls: string[] | null
  result: Record<string, unknown> | null
  research_confidence: number | null
  equipify_fit_score: number | null
  model_task: string | null
  model_provider: string | null
  model_name: string | null
  error_code: string | null
  error_message: string | null
  duration_ms: number | null
  input_hash: string | null
  created_by: string | null
  created_at: string
  finished_at: string | null
}

function researchRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_research_runs")
}

function researchNotesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_research_notes")
}

function mapResult(raw: Record<string, unknown> | null): GrowthLeadResearchResult | null {
  if (!raw) return null
  return {
    companySummary: String(raw.companySummary ?? raw.company_summary ?? ""),
    websiteSummary:
      raw.websiteSummary != null ? String(raw.websiteSummary)
      : raw.website_summary != null ? String(raw.website_summary)
      : null,
    likelyServiceCategory:
      raw.likelyServiceCategory != null ? String(raw.likelyServiceCategory)
      : raw.likely_service_category != null ? String(raw.likely_service_category)
      : null,
    serviceAreaClues: Array.isArray(raw.serviceAreaClues)
      ? (raw.serviceAreaClues as string[])
      : Array.isArray(raw.service_area_clues)
        ? (raw.service_area_clues as string[])
        : [],
    companySizeEstimate:
      raw.companySizeEstimate != null ? String(raw.companySizeEstimate)
      : raw.company_size_estimate != null ? String(raw.company_size_estimate)
      : null,
    equipmentServiceIndicators: Array.isArray(raw.equipmentServiceIndicators)
      ? (raw.equipmentServiceIndicators as string[])
      : Array.isArray(raw.equipment_service_indicators)
        ? (raw.equipment_service_indicators as string[])
        : [],
    equipifyPainPoints: Array.isArray(raw.equipifyPainPoints)
      ? (raw.equipifyPainPoints as string[])
      : Array.isArray(raw.equipify_pain_points)
        ? (raw.equipify_pain_points as string[])
        : [],
    equipifyFitScore: Number(raw.equipifyFitScore ?? raw.equipify_fit_score ?? 0),
    outreachAngles: Array.isArray(raw.outreachAngles)
      ? (raw.outreachAngles as string[])
      : Array.isArray(raw.outreach_angles)
        ? (raw.outreach_angles as string[])
        : [],
    recommendedNextAction: String(raw.recommendedNextAction ?? raw.recommended_next_action ?? ""),
    researchConfidence: Number(raw.researchConfidence ?? raw.research_confidence ?? 0),
    sourceUrls: Array.isArray(raw.sourceUrls)
      ? (raw.sourceUrls as string[])
      : Array.isArray(raw.source_urls)
        ? (raw.source_urls as string[])
        : [],
    caveats: Array.isArray(raw.caveats) ? (raw.caveats as string[]) : [],
    fitModelVersion: String(raw.fitModelVersion ?? raw.fit_model_version ?? GROWTH_LEAD_FIT_MODEL_VERSION),
  }
}

function mapResearchRunRow(row: ResearchRunDbRow): GrowthLeadResearchRun {
  return {
    id: row.id,
    leadId: row.lead_id,
    status: row.status as GrowthLeadResearchRunStatus,
    triggerKind: row.trigger_kind === "regenerate" ? "regenerate" : "manual",
    websiteUrl: row.website_url,
    websiteFetchStatus: row.website_fetch_status,
    websiteTextExcerpt: row.website_text_excerpt,
    sourceUrls: row.source_urls ?? [],
    result: mapResult(row.result),
    researchConfidence: row.research_confidence,
    equipifyFitScore: row.equipify_fit_score,
    modelTask: row.model_task,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    durationMs: row.duration_ms,
    inputHash: row.input_hash,
    createdBy: row.created_by,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  }
}

function leadInputSnapshot(lead: GrowthLead): Record<string, unknown> {
  return {
    company_name: lead.companyName,
    contact_name: lead.contactName,
    contact_email: lead.contactEmail,
    contact_phone: lead.contactPhone,
    website: lead.website,
    city: lead.city,
    state: lead.state,
    country: lead.country,
    source_kind: lead.sourceKind,
    source_detail: lead.sourceDetail,
    status: lead.status,
    notes: lead.notes,
  }
}

export async function fetchCachedGrowthLeadResearchRun(
  admin: SupabaseClient,
  leadId: string,
  inputHash: string,
): Promise<GrowthLeadResearchRun | null> {
  const since = new Date(Date.now() - GROWTH_LEAD_RESEARCH_CACHE_TTL_MS).toISOString()
  const { data, error } = await researchRunsTable(admin)
    .select(RUN_SELECT)
    .eq("lead_id", leadId)
    .eq("input_hash", inputHash)
    .in("status", ["succeeded", "partial"])
    .gte("finished_at", since)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logGrowthEngine("research_cache_lookup_failed", {
      table: "growth.lead_research_runs",
      leadId,
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  return data ? mapResearchRunRow(data as ResearchRunDbRow) : null
}

export async function insertGrowthLeadResearchRun(
  admin: SupabaseClient,
  input: {
    lead: GrowthLead
    triggerKind: "manual" | "regenerate"
    inputHash: string
    websiteUrl?: string | null
    createdBy: string | null
  },
): Promise<GrowthLeadResearchRun> {
  const row = {
    lead_id: input.lead.id,
    status: "running",
    trigger_kind: input.triggerKind,
    input_snapshot: leadInputSnapshot(input.lead),
    input_hash: input.inputHash,
    website_url: input.websiteUrl ?? null,
    website_fetch_status: "skipped",
    source_urls: [],
    created_by: input.createdBy,
  }

  const { data, error } = await researchRunsTable(admin).insert(row).select(RUN_SELECT).single()
  if (error) {
    logGrowthEngine("research_run_insert_failed", {
      table: "growth.lead_research_runs",
      leadId: input.lead.id,
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  return mapResearchRunRow(data as ResearchRunDbRow)
}

export async function finishGrowthLeadResearchRun(
  admin: SupabaseClient,
  runId: string,
  patch: {
    status: GrowthLeadResearchRunStatus
    result?: GrowthLeadResearchResult | null
    researchConfidence?: number | null
    equipifyFitScore?: number | null
    websiteUrl?: string | null
    websiteFetchStatus?: string
    websiteTextExcerpt?: string | null
    sourceUrls?: string[]
    modelTask?: string | null
    modelProvider?: string | null
    modelName?: string | null
    errorCode?: string | null
    errorMessage?: string | null
    durationMs?: number | null
  },
): Promise<GrowthLeadResearchRun | null> {
  const update: Record<string, unknown> = {
    status: patch.status,
    result: patch.result ?? null,
    research_confidence: patch.researchConfidence ?? null,
    equipify_fit_score: patch.equipifyFitScore ?? null,
    source_urls: patch.sourceUrls ?? [],
    model_task: patch.modelTask ?? null,
    model_provider: patch.modelProvider ?? null,
    model_name: patch.modelName ?? null,
    error_code: patch.errorCode ?? null,
    error_message: patch.errorMessage?.slice(0, 500) ?? null,
    duration_ms: patch.durationMs ?? null,
    finished_at: new Date().toISOString(),
  }

  if (patch.websiteUrl !== undefined) update.website_url = patch.websiteUrl
  if (patch.websiteFetchStatus !== undefined) update.website_fetch_status = patch.websiteFetchStatus
  if (patch.websiteTextExcerpt !== undefined) update.website_text_excerpt = patch.websiteTextExcerpt

  const { data, error } = await researchRunsTable(admin)
    .update(update)
    .eq("id", runId)
    .select(RUN_SELECT)
    .maybeSingle()

  if (error) {
    logGrowthEngine("research_run_finish_failed", {
      table: "growth.lead_research_runs",
      runId,
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  return data ? mapResearchRunRow(data as ResearchRunDbRow) : null
}

export async function listGrowthLeadResearchRuns(
  admin: SupabaseClient,
  leadId: string,
  limit = 10,
): Promise<GrowthLeadResearchRun[]> {
  const { data, error } = await researchRunsTable(admin)
    .select(RUN_SELECT)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return ((data ?? []) as ResearchRunDbRow[]).map(mapResearchRunRow)
}

export async function fetchLatestUsableGrowthLeadResearchRun(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLeadResearchRun | null> {
  const { data, error } = await researchRunsTable(admin)
    .select(RUN_SELECT)
    .eq("lead_id", leadId)
    .in("status", ["succeeded", "partial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapResearchRunRow(data as ResearchRunDbRow) : null
}

export async function fetchGrowthLeadResearchNotes(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLeadResearchNotes | null> {
  const { data, error } = await researchNotesTable(admin)
    .select("body, updated_by, updated_at")
    .eq("lead_id", leadId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as { body: string; updated_by: string | null; updated_at: string }
  return {
    body: row.body ?? "",
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

export async function upsertGrowthLeadResearchNotes(
  admin: SupabaseClient,
  input: { leadId: string; body: string; updatedBy: string | null },
): Promise<GrowthLeadResearchNotes> {
  const { data, error } = await researchNotesTable(admin)
    .upsert(
      {
        lead_id: input.leadId,
        body: input.body.trim(),
        updated_by: input.updatedBy,
      },
      { onConflict: "lead_id" },
    )
    .select("body, updated_by, updated_at")
    .single()

  if (error) throw new Error(error.message)

  const row = data as { body: string; updated_by: string | null; updated_at: string }
  logGrowthEngine("research_notes_saved", { leadId: input.leadId })
  return {
    body: row.body ?? "",
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }
}

export async function loadGrowthLeadResearchBundle(
  admin: SupabaseClient,
  leadId: string,
): Promise<{ runs: GrowthLeadResearchRun[]; latestRun: GrowthLeadResearchRun | null; manualNotes: GrowthLeadResearchNotes | null }> {
  const [runs, latestRun, manualNotes] = await Promise.all([
    listGrowthLeadResearchRuns(admin, leadId, 10),
    fetchLatestUsableGrowthLeadResearchRun(admin, leadId),
    fetchGrowthLeadResearchNotes(admin, leadId),
  ])
  return { runs, latestRun, manualNotes }
}
