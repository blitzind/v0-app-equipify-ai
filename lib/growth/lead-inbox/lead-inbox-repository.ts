import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertLeadInboxStatusTransition,
  pipelineStatusForInboxStatus,
  requiresHumanReview,
} from "@/lib/growth/lead-inbox/lead-inbox-status-engine"
import {
  checkLeadInboxDuplicate,
  resolveLeadInboxCrmMatches,
  validateInboxPiiPolicy,
} from "@/lib/growth/lead-inbox/lead-inbox-dedupe"
import {
  mergeCanonicalLeadIntoInboxMetadata,
  resolveCanonicalLeadForDuplicateInbox,
  resolveCanonicalLeadForInboxInput,
} from "@/lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge"
import { logGrowthEngine } from "@/lib/growth/access"
import { sortLeadInboxQueue } from "@/lib/growth/lead-inbox/lead-inbox-priority"
import { isGrowthLeadInboxSchemaReady, GROWTH_LEAD_INBOX_SCHEMA_SETUP_MESSAGE } from "@/lib/growth/lead-inbox/lead-inbox-schema-health"
import {
  GROWTH_LEAD_INBOX_QA_MARKER,
  type GrowthLeadInboxCreateInput,
  type GrowthLeadInboxCreateResult,
  type GrowthLeadInboxCrmMatch,
  type GrowthLeadInboxLoadFilters,
  type GrowthLeadInboxLoadResult,
  type GrowthLeadInboxRow,
  type GrowthLeadInboxStatus,
} from "@/lib/growth/lead-inbox/lead-inbox-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function parseCrmMatch(value: unknown): GrowthLeadInboxCrmMatch {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    matched: row.matched === true,
    source: asString(row.source) || null,
    ids: Array.isArray(row.ids) ? row.ids.filter((id): id is string => typeof id === "string") : [],
    evidence: asString(row.evidence),
  }
}

async function loadDuplicateInboxContextForBackfill(
  admin: SupabaseClient,
  inboxId: string,
): Promise<{ metadata?: Record<string, unknown> } | null> {
  try {
    const { data } = await admin
      .schema("growth")
      .from("lead_inbox")
      .select("metadata")
      .eq("id", inboxId)
      .maybeSingle()
    if (!data) return null
    const row = data as Record<string, unknown>
    return {
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
    }
  } catch {
    return null
  }
}

function mapRow(row: Record<string, unknown>): GrowthLeadInboxRow {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    site_key: asString(row.site_key),
    candidate_type: asString(row.candidate_type) as GrowthLeadInboxRow["candidate_type"],
    candidate_priority: asString(row.candidate_priority) as GrowthLeadInboxRow["candidate_priority"],
    intent_score: typeof row.intent_score === "number" ? row.intent_score : 0,
    intent_grade: asString(row.intent_grade) || "F",
    candidate_confidence:
      typeof row.candidate_confidence === "number" ? Number(row.candidate_confidence) : 0,
    pipeline_entry: asString(row.pipeline_entry) as GrowthLeadInboxRow["pipeline_entry"],
    pipeline_status: asString(row.pipeline_status) as GrowthLeadInboxRow["pipeline_status"],
    company_name: asString(row.company_name),
    domain: asString(row.domain) || null,
    contact_name: asString(row.contact_name) || null,
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    dedupe_hash: asString(row.dedupe_hash),
    candidate_reasoning: parseJsonArray<string>(row.candidate_reasoning),
    candidate_evidence: parseJsonArray(row.candidate_evidence) as GrowthLeadInboxRow["candidate_evidence"],
    candidate_attribution: parseJsonArray(row.candidate_attribution) as GrowthLeadInboxRow["candidate_attribution"],
    session_count: typeof row.session_count === "number" ? row.session_count : 0,
    visit_count: typeof row.visit_count === "number" ? row.visit_count : 0,
    utm_source: asString(row.utm_source),
    utm_medium: asString(row.utm_medium),
    utm_campaign: asString(row.utm_campaign),
    owner_id: asString(row.owner_id) || null,
    status: asString(row.status) as GrowthLeadInboxStatus,
    human_review_required: row.human_review_required !== false,
    lead_engine_run_id: asString(row.lead_engine_run_id) || null,
    intent_session_id: asString(row.intent_session_id),
    visitor_key: asString(row.visitor_key),
    existing_account_match: parseCrmMatch(row.existing_account_match),
    existing_lead_match: parseCrmMatch(row.existing_lead_match),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

function assertAttributionAndEvidence(input: GrowthLeadInboxCreateInput): string | null {
  if (input.candidate_attribution.length === 0) {
    return "candidate_attribution is required."
  }
  if (input.candidate_evidence.length === 0) {
    return "candidate_evidence is required."
  }
  for (const entry of input.candidate_attribution) {
    if (!entry.source?.trim() || !entry.evidence?.trim()) {
      return "Each attribution entry requires source and evidence."
    }
  }
  return null
}

export async function createLeadCandidate(
  admin: SupabaseClient,
  input: GrowthLeadInboxCreateInput,
): Promise<GrowthLeadInboxCreateResult> {
  if (!(await isGrowthLeadInboxSchemaReady(admin))) {
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: GROWTH_LEAD_INBOX_SCHEMA_SETUP_MESSAGE,
      errors: [GROWTH_LEAD_INBOX_SCHEMA_SETUP_MESSAGE],
    }
  }

  const validationError = assertAttributionAndEvidence(input)
  if (validationError) {
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: validationError,
      errors: [validationError],
    }
  }

  const pii = validateInboxPiiPolicy(input)
  let sanitized = pii.sanitized
  const actor = input.actor

  if (!sanitized.existing_lead_match && !sanitized.existing_account_match) {
    const crm = await resolveLeadInboxCrmMatches(admin, sanitized)
    sanitized = {
      ...sanitized,
      existing_account_match: crm.existing_account_match,
      existing_lead_match: crm.existing_lead_match,
    }
  }

  const dedupe = await checkLeadInboxDuplicate(admin, {
    dedupe_hash: sanitized.dedupe_hash,
    intent_session_id: sanitized.intent_session_id,
    email: sanitized.email,
    phone: sanitized.phone,
    domain: sanitized.domain,
  })

  if (dedupe.is_duplicate) {
    const canonical =
      dedupe.existing_inbox_id != null
        ? await resolveCanonicalLeadForDuplicateInbox(admin, sanitized, dedupe.existing_inbox_id, actor)
        : null

    if (dedupe.existing_inbox_id && canonical) {
      try {
        const existingRow = await loadDuplicateInboxContextForBackfill(admin, dedupe.existing_inbox_id)
        await admin
          .schema("growth")
          .from("lead_inbox")
          .update({
            metadata: mergeCanonicalLeadIntoInboxMetadata(existingRow?.metadata, canonical),
            updated_at: new Date().toISOString(),
          })
          .eq("id", dedupe.existing_inbox_id)
      } catch {
        // fault isolated — duplicate response still returns canonical id
      }
    }

    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: true,
      reason: `Duplicate prevented (${dedupe.reasons.join(", ")}).`,
      errors: [],
      growth_lead_id: canonical?.growth_lead_id ?? null,
      lead_status: canonical?.lead_status ?? null,
      lead_created: canonical ? false : null,
    }
  }

  const canonical = await resolveCanonicalLeadForInboxInput(admin, sanitized, actor)
  if ("error" in canonical) {
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: canonical.error,
      errors: [canonical.error],
      growth_lead_id: null,
      lead_status: null,
      lead_created: null,
    }
  }

  sanitized = {
    ...sanitized,
    metadata: mergeCanonicalLeadIntoInboxMetadata(sanitized.metadata, canonical),
  }

  logGrowthEngine("lead_inbox_canonical_intake_linked", {
    growthLeadId: canonical.growth_lead_id,
    leadCreated: canonical.lead_created,
    dedupeRule: canonical.dedupe_rule,
    siteKey: sanitized.site_key,
  })

  const initialStatus: GrowthLeadInboxStatus =
    sanitized.existing_account_match?.matched || sanitized.existing_lead_match?.matched
      ? "reviewing"
      : "new"

  try {
    const { data, error } = await admin
      .schema("growth")
      .from("lead_inbox")
      .insert({
        site_key: sanitized.site_key,
        candidate_type: sanitized.candidate_type,
        candidate_priority: sanitized.candidate_priority,
        intent_score: sanitized.intent_score,
        intent_grade: sanitized.intent_grade,
        candidate_confidence: sanitized.candidate_confidence,
        pipeline_entry: sanitized.pipeline_entry,
        pipeline_status: "not_started",
        company_name: sanitized.company_name ?? "",
        domain: sanitized.domain,
        contact_name: sanitized.contact_name,
        email: sanitized.email,
        phone: sanitized.phone,
        linkedin_url: sanitized.linkedin_url,
        dedupe_hash: sanitized.dedupe_hash,
        candidate_reasoning: sanitized.candidate_reasoning,
        candidate_evidence: sanitized.candidate_evidence,
        candidate_attribution: sanitized.candidate_attribution,
        session_count: sanitized.session_count,
        visit_count: sanitized.visit_count,
        utm_source: sanitized.utm_source ?? "",
        utm_medium: sanitized.utm_medium ?? "",
        utm_campaign: sanitized.utm_campaign ?? "",
        intent_session_id: sanitized.intent_session_id,
        visitor_key: sanitized.visitor_key,
        existing_account_match: sanitized.existing_account_match ?? {
          matched: false,
          source: null,
          ids: [],
          evidence: "",
        },
        existing_lead_match: sanitized.existing_lead_match ?? {
          matched: false,
          source: null,
          ids: [],
          evidence: "",
        },
        status: initialStatus,
        human_review_required: sanitized.human_review_required ?? true,
        metadata: sanitized.metadata ?? {},
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) {
      const dup = error.message.includes("duplicate") || error.code === "23505"
      return {
        qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
        ok: false,
        row: null,
        duplicate: dup,
        reason: error.message,
        errors: [error.message],
      }
    }

    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: true,
      row: mapRow(data as Record<string, unknown>),
      duplicate: false,
      reason: "Lead inbox candidate created.",
      errors: [],
      growth_lead_id: canonical.growth_lead_id,
      lead_status: canonical.lead_status,
      lead_created: canonical.lead_created,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: message,
      errors: [message],
    }
  }
}

export async function loadLeadInbox(
  admin: SupabaseClient,
  filters: GrowthLeadInboxLoadFilters = {},
): Promise<GrowthLeadInboxLoadResult> {
  if (!(await isGrowthLeadInboxSchemaReady(admin))) {
    return { qa_marker: GROWTH_LEAD_INBOX_QA_MARKER, items: [], total: 0 }
  }

  const limit = Math.min(100, Math.max(1, filters.limit ?? 50))
  const offset = Math.max(0, filters.offset ?? 0)

  let query = admin.schema("growth").from("lead_inbox").select("*", { count: "exact" })

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    query = query.in("status", statuses)
  }
  if (filters.owner_id !== undefined) {
    if (filters.owner_id === null) query = query.is("owner_id", null)
    else query = query.eq("owner_id", filters.owner_id)
  }
  if (filters.candidate_priority) query = query.eq("candidate_priority", filters.candidate_priority)
  if (filters.pipeline_status) query = query.eq("pipeline_status", filters.pipeline_status)

  const { data, error, count } = await query
    .order("intent_score", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return { qa_marker: GROWTH_LEAD_INBOX_QA_MARKER, items: [], total: 0 }
  }

  const items = sortLeadInboxQueue(
    ((data ?? []) as Record<string, unknown>[]).map(mapRow),
  )

  return {
    qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
    items,
    total: count ?? items.length,
  }
}

async function updateLeadInboxRow(
  admin: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<GrowthLeadInboxRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("lead_inbox")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function fetchLeadInboxById(
  admin: SupabaseClient,
  id: string,
): Promise<GrowthLeadInboxRow | null> {
  if (!(await isGrowthLeadInboxSchemaReady(admin))) return null
  const { data, error } = await admin
    .schema("growth")
    .from("lead_inbox")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function claimLead(
  admin: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<GrowthLeadInboxRow | null> {
  const row = await fetchLeadInboxById(admin, id)
  if (!row) return null

  const transition = assertLeadInboxStatusTransition(row.status, "reviewing")
  if (!transition.ok) return null

  return updateLeadInboxRow(admin, id, {
    owner_id: ownerId,
    status: "reviewing",
    human_review_required: requiresHumanReview("reviewing"),
  })
}

export async function archiveLead(
  admin: SupabaseClient,
  id: string,
): Promise<GrowthLeadInboxRow | null> {
  const row = await fetchLeadInboxById(admin, id)
  if (!row) return null

  const transition = assertLeadInboxStatusTransition(row.status, "archived")
  if (!transition.ok) return null

  return updateLeadInboxRow(admin, id, {
    status: "archived",
    human_review_required: false,
    pipeline_status: pipelineStatusForInboxStatus("archived", row.pipeline_status),
  })
}

export async function markDuplicate(
  admin: SupabaseClient,
  id: string,
  reason?: string,
): Promise<GrowthLeadInboxRow | null> {
  const row = await fetchLeadInboxById(admin, id)
  if (!row) return null

  const transition = assertLeadInboxStatusTransition(row.status, "duplicate")
  if (!transition.ok && row.status !== "duplicate") return null

  return updateLeadInboxRow(admin, id, {
    status: "duplicate",
    human_review_required: false,
    metadata: {
      ...row.metadata,
      duplicate_reason: reason ?? "Marked duplicate.",
    },
  })
}

export type GrowthLeadInboxPromoteOptions = {
  lead_engine_run_id?: string | null
  status?: "approved" | "enriching" | "running_pipeline"
}

/** Queue candidate for Lead Engine — does not auto-run pipeline. */
export async function promoteToPipeline(
  admin: SupabaseClient,
  id: string,
  options: GrowthLeadInboxPromoteOptions = {},
): Promise<GrowthLeadInboxRow | null> {
  const row = await fetchLeadInboxById(admin, id)
  if (!row) return null

  const nextStatus = options.status ?? "approved"
  const transition = assertLeadInboxStatusTransition(row.status, nextStatus)
  if (!transition.ok) return null

  return updateLeadInboxRow(admin, id, {
    status: nextStatus,
    pipeline_status: pipelineStatusForInboxStatus(nextStatus, row.pipeline_status),
    lead_engine_run_id: options.lead_engine_run_id ?? row.lead_engine_run_id,
    human_review_required: requiresHumanReview(nextStatus),
    metadata: {
      ...row.metadata,
      promoted_at: new Date().toISOString(),
      promotion_note: "Infrastructure only — pipeline not auto-executed.",
    },
  })
}

export async function assignLeadOwner(
  admin: SupabaseClient,
  id: string,
  ownerId: string,
): Promise<GrowthLeadInboxRow | null> {
  const row = await fetchLeadInboxById(admin, id)
  if (!row) return null
  return updateLeadInboxRow(admin, id, { owner_id: ownerId })
}

export async function saveLeadInboxMetadataPatch(
  admin: SupabaseClient,
  id: string,
  metadataPatch: Record<string, unknown>,
): Promise<GrowthLeadInboxRow | null> {
  const row = await fetchLeadInboxById(admin, id)
  if (!row) return null
  return updateLeadInboxRow(admin, id, {
    metadata: { ...row.metadata, ...metadataPatch },
  })
}

export async function disqualifyLead(
  admin: SupabaseClient,
  id: string,
  reason?: string,
): Promise<GrowthLeadInboxRow | null> {
  const row = await fetchLeadInboxById(admin, id)
  if (!row) return null

  const transition = assertLeadInboxStatusTransition(row.status, "disqualified")
  if (!transition.ok) return null

  return updateLeadInboxRow(admin, id, {
    status: "disqualified",
    human_review_required: false,
    metadata: { ...row.metadata, disqualify_reason: reason ?? "" },
  })
}
