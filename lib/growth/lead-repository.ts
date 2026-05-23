import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type {
  CreateGrowthLeadInput,
  GrowthLead,
  GrowthLeadStatus,
  ListGrowthLeadsInput,
  UpdateGrowthLeadInput,
} from "@/lib/growth/types"

const LEAD_SELECT =
  "id, source_kind, source_detail, external_ref, company_name, contact_name, contact_email, contact_phone, website, address_line1, city, state, postal_code, country, status, promoted_organization_id, promoted_prospect_id, promoted_at, score, notes, metadata, latest_research_run_id, last_researched_at, research_priority, created_by, assigned_to, created_at, updated_at"

type GrowthLeadDbRow = {
  id: string
  source_kind: string
  source_detail: string | null
  external_ref: string | null
  company_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  status: string
  promoted_organization_id: string | null
  promoted_prospect_id: string | null
  promoted_at: string | null
  score: number | null
  notes: string | null
  metadata: Record<string, unknown> | null
  latest_research_run_id: string | null
  last_researched_at: string | null
  research_priority: string
  created_by: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function mapGrowthLeadRow(row: GrowthLeadDbRow): GrowthLead {
  return {
    id: row.id,
    sourceKind: row.source_kind as GrowthLead["sourceKind"],
    sourceDetail: row.source_detail,
    externalRef: row.external_ref,
    companyName: row.company_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    website: row.website,
    addressLine1: row.address_line1,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    status: row.status as GrowthLeadStatus,
    promotedOrganizationId: row.promoted_organization_id,
    promotedProspectId: row.promoted_prospect_id,
    promotedAt: row.promoted_at,
    score: row.score,
    notes: row.notes,
    metadata: row.metadata ?? {},
    latestResearchRunId: row.latest_research_run_id,
    lastResearchedAt: row.last_researched_at,
    researchPriority: row.research_priority as GrowthLead["researchPriority"],
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listGrowthLeads(
  admin: SupabaseClient,
  input: ListGrowthLeadsInput = {},
): Promise<GrowthLead[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200)
  const offset = Math.max(input.offset ?? 0, 0)

  let query = growthLeadsTable(admin).select(LEAD_SELECT).order("created_at", { ascending: false })

  if (input.status) {
    query = query.eq("status", input.status)
  }

  const { data, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    logGrowthEngine("lead_list_failed", {
      table: "growth.leads",
      action: "select",
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  return ((data ?? []) as GrowthLeadDbRow[]).map(mapGrowthLeadRow)
}

export async function fetchGrowthLeadById(admin: SupabaseClient, leadId: string): Promise<GrowthLead | null> {
  const { data, error } = await growthLeadsTable(admin).select(LEAD_SELECT).eq("id", leadId).maybeSingle()

  if (error) {
    logGrowthEngine("lead_fetch_failed", {
      table: "growth.leads",
      action: "select",
      leadId,
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  return data ? mapGrowthLeadRow(data as GrowthLeadDbRow) : null
}

export async function createGrowthLead(
  admin: SupabaseClient,
  input: CreateGrowthLeadInput,
): Promise<GrowthLead> {
  const companyName = input.companyName.trim()
  if (!companyName) {
    throw new Error("company_name_required")
  }

  const row = {
    source_kind: input.sourceKind ?? "manual",
    source_detail: trimOrNull(input.sourceDetail),
    external_ref: trimOrNull(input.externalRef),
    company_name: companyName,
    contact_name: trimOrNull(input.contactName),
    contact_email: trimOrNull(input.contactEmail),
    contact_phone: trimOrNull(input.contactPhone),
    website: trimOrNull(input.website),
    address_line1: trimOrNull(input.addressLine1),
    city: trimOrNull(input.city),
    state: trimOrNull(input.state),
    postal_code: trimOrNull(input.postalCode),
    country: trimOrNull(input.country) ?? "US",
    status: input.status ?? "new",
    score: input.score ?? null,
    notes: trimOrNull(input.notes),
    metadata: input.metadata ?? {},
    research_priority: input.researchPriority ?? "normal",
    assigned_to: trimOrNull(input.assignedTo),
    created_by: trimOrNull(input.createdBy),
  }

  const { data, error } = await growthLeadsTable(admin).insert(row).select(LEAD_SELECT).single()

  if (error) {
    logGrowthEngine("lead_create_failed", {
      table: "growth.leads",
      action: "insert",
      code: error.code ?? null,
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
    })
    throw new Error(error.message)
  }

  const lead = mapGrowthLeadRow(data as GrowthLeadDbRow)
  logGrowthEngine("lead_created", {
    leadId: lead.id,
    status: lead.status,
    sourceKind: lead.sourceKind,
    companyName: lead.companyName,
  })
  return lead
}

export async function updateGrowthLead(
  admin: SupabaseClient,
  leadId: string,
  input: UpdateGrowthLeadInput,
): Promise<GrowthLead | null> {
  const patch: Record<string, unknown> = {}

  if (input.sourceKind !== undefined) patch.source_kind = input.sourceKind
  if (input.sourceDetail !== undefined) patch.source_detail = trimOrNull(input.sourceDetail)
  if (input.externalRef !== undefined) patch.external_ref = trimOrNull(input.externalRef)
  if (input.companyName !== undefined) {
    const companyName = input.companyName.trim()
    if (!companyName) throw new Error("company_name_required")
    patch.company_name = companyName
  }
  if (input.contactName !== undefined) patch.contact_name = trimOrNull(input.contactName)
  if (input.contactEmail !== undefined) patch.contact_email = trimOrNull(input.contactEmail)
  if (input.contactPhone !== undefined) patch.contact_phone = trimOrNull(input.contactPhone)
  if (input.website !== undefined) patch.website = trimOrNull(input.website)
  if (input.addressLine1 !== undefined) patch.address_line1 = trimOrNull(input.addressLine1)
  if (input.city !== undefined) patch.city = trimOrNull(input.city)
  if (input.state !== undefined) patch.state = trimOrNull(input.state)
  if (input.postalCode !== undefined) patch.postal_code = trimOrNull(input.postalCode)
  if (input.country !== undefined) patch.country = trimOrNull(input.country)
  if (input.status !== undefined) patch.status = input.status
  if (input.score !== undefined) patch.score = input.score
  if (input.notes !== undefined) patch.notes = trimOrNull(input.notes)
  if (input.metadata !== undefined) patch.metadata = input.metadata
  if (input.researchPriority !== undefined) patch.research_priority = input.researchPriority
  if (input.assignedTo !== undefined) patch.assigned_to = trimOrNull(input.assignedTo)

  if (Object.keys(patch).length === 0) {
    throw new Error("empty_patch")
  }

  const { data, error } = await growthLeadsTable(admin)
    .update(patch)
    .eq("id", leadId)
    .select(LEAD_SELECT)
    .maybeSingle()

  if (error) {
    logGrowthEngine("lead_update_failed", {
      table: "growth.leads",
      action: "update",
      leadId,
      code: error.code ?? null,
      message: error.message,
      details: error.details ?? null,
      hint: error.hint ?? null,
    })
    throw new Error(error.message)
  }

  if (!data) return null

  const lead = mapGrowthLeadRow(data as GrowthLeadDbRow)
  logGrowthEngine("lead_updated", {
    leadId: lead.id,
    status: lead.status,
    patchedFields: Object.keys(patch),
  })
  return lead
}

export async function markGrowthLeadResearchCompleted(
  admin: SupabaseClient,
  input: {
    leadId: string
    latestResearchRunId: string
    equipifyFitScore: number
    status: GrowthLeadStatus
  },
): Promise<GrowthLead | null> {
  const now = new Date().toISOString()
  const { data, error } = await growthLeadsTable(admin)
    .update({
      status: input.status,
      score: input.equipifyFitScore,
      latest_research_run_id: input.latestResearchRunId,
      last_researched_at: now,
    })
    .eq("id", input.leadId)
    .select(LEAD_SELECT)
    .maybeSingle()

  if (error) {
    logGrowthEngine("lead_research_tracking_failed", {
      table: "growth.leads",
      action: "update",
      leadId: input.leadId,
      runId: input.latestResearchRunId,
      code: error.code ?? null,
      message: error.message,
    })
    throw new Error(error.message)
  }

  if (!data) return null

  const lead = mapGrowthLeadRow(data as GrowthLeadDbRow)
  logGrowthEngine("lead_research_tracking_updated", {
    leadId: lead.id,
    latestResearchRunId: input.latestResearchRunId,
    lastResearchedAt: now,
  })
  return lead
}
