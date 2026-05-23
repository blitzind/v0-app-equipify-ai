import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { decisionMakerCandidateScore } from "@/lib/growth/decision-maker-source-weight"
import type {
  GrowthDecisionMakerCandidate,
  GrowthDecisionMakerPresenceStatus,
  GrowthDecisionMakerSource,
  GrowthDecisionMakerStatus,
  GrowthLeadDecisionMaker,
} from "@/lib/growth/decision-maker-types"
import { emitGrowthLeadDecisionMakerTimeline } from "@/lib/growth/timeline-emitter"

const DM_SELECT =
  "id, lead_id, full_name, title, email, phone, linkedin_url, source, source_detail, confidence, evidence_excerpt, status, is_primary, created_by, created_at, updated_at"

type DecisionMakerDbRow = {
  id: string
  lead_id: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  source: string
  source_detail: string | null
  confidence: number | null
  evidence_excerpt: string | null
  status: string
  is_primary: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

function decisionMakersTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_decision_makers")
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function mapDecisionMakerRow(row: DecisionMakerDbRow): GrowthLeadDecisionMaker {
  return {
    id: row.id,
    leadId: row.lead_id,
    fullName: row.full_name,
    title: row.title,
    email: row.email,
    phone: row.phone,
    linkedinUrl: row.linkedin_url,
    source: row.source as GrowthDecisionMakerSource,
    sourceDetail: row.source_detail,
    confidence: row.confidence,
    evidenceExcerpt: row.evidence_excerpt,
    status: row.status as GrowthDecisionMakerStatus,
    isPrimary: row.is_primary,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listGrowthLeadDecisionMakers(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthLeadDecisionMaker[]> {
  const { data, error } = await decisionMakersTable(admin)
    .select(DM_SELECT)
    .eq("lead_id", leadId)
    .neq("status", "rejected")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as DecisionMakerDbRow[]).map(mapDecisionMakerRow)
}

export async function fetchGrowthLeadDecisionMakerById(
  admin: SupabaseClient,
  leadId: string,
  decisionMakerId: string,
): Promise<GrowthLeadDecisionMaker | null> {
  const { data, error } = await decisionMakersTable(admin)
    .select(DM_SELECT)
    .eq("lead_id", leadId)
    .eq("id", decisionMakerId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapDecisionMakerRow(data as DecisionMakerDbRow) : null
}

export async function createGrowthLeadDecisionMaker(
  admin: SupabaseClient,
  input: {
    leadId: string
    fullName: string
    title?: string | null
    email?: string | null
    phone?: string | null
    linkedinUrl?: string | null
    source?: GrowthDecisionMakerSource
    sourceDetail?: string | null
    confidence?: number | null
    evidenceExcerpt?: string | null
    status?: GrowthDecisionMakerStatus
    isPrimary?: boolean
    createdBy?: string | null
  },
): Promise<GrowthLeadDecisionMaker> {
  const fullName = input.fullName.trim()
  if (!fullName) throw new Error("full_name_required")

  if (input.isPrimary) {
    await decisionMakersTable(admin)
      .update({ is_primary: false })
      .eq("lead_id", input.leadId)
      .eq("is_primary", true)
  }

  const { data, error } = await decisionMakersTable(admin)
    .insert({
      lead_id: input.leadId,
      full_name: fullName,
      title: trimOrNull(input.title),
      email: trimOrNull(input.email),
      phone: trimOrNull(input.phone),
      linkedin_url: trimOrNull(input.linkedinUrl),
      source: input.source ?? "manual",
      source_detail: trimOrNull(input.sourceDetail),
      confidence: input.confidence ?? null,
      evidence_excerpt: trimOrNull(input.evidenceExcerpt),
      status: input.status ?? "suspected",
      is_primary: input.isPrimary ?? false,
      created_by: trimOrNull(input.createdBy),
    })
    .select(DM_SELECT)
    .single()

  if (error) throw new Error(error.message)
  const row = mapDecisionMakerRow(data as DecisionMakerDbRow)
  await emitGrowthLeadDecisionMakerTimeline(admin, {
    leadId: input.leadId,
    eventType: "decision_maker_added",
    decisionMakerId: row.id,
    fullName: row.fullName,
  })
  return row
}

export async function updateGrowthLeadDecisionMaker(
  admin: SupabaseClient,
  leadId: string,
  decisionMakerId: string,
  input: {
    fullName?: string
    title?: string | null
    email?: string | null
    phone?: string | null
    linkedinUrl?: string | null
    status?: GrowthDecisionMakerStatus
    isPrimary?: boolean
  },
): Promise<GrowthLeadDecisionMaker | null> {
  const patch: Record<string, unknown> = {}

  if (input.fullName !== undefined) {
    const fullName = input.fullName.trim()
    if (!fullName) throw new Error("full_name_required")
    patch.full_name = fullName
  }
  if (input.title !== undefined) patch.title = trimOrNull(input.title)
  if (input.email !== undefined) patch.email = trimOrNull(input.email)
  if (input.phone !== undefined) patch.phone = trimOrNull(input.phone)
  if (input.linkedinUrl !== undefined) patch.linkedin_url = trimOrNull(input.linkedinUrl)
  if (input.status !== undefined) patch.status = input.status

  if (input.isPrimary === true) {
    await decisionMakersTable(admin)
      .update({ is_primary: false })
      .eq("lead_id", leadId)
      .eq("is_primary", true)
    patch.is_primary = true
  } else if (input.isPrimary === false) {
    patch.is_primary = false
  }

  if (Object.keys(patch).length === 0) throw new Error("empty_patch")

  const existing = await fetchGrowthLeadDecisionMakerById(admin, leadId, decisionMakerId)

  const { data, error } = await decisionMakersTable(admin)
    .update(patch)
    .eq("lead_id", leadId)
    .eq("id", decisionMakerId)
    .select(DM_SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = mapDecisionMakerRow(data as DecisionMakerDbRow)
  if (input.status === "confirmed" && existing?.status !== "confirmed") {
    await emitGrowthLeadDecisionMakerTimeline(admin, {
      leadId,
      eventType: "decision_maker_confirmed",
      decisionMakerId: row.id,
      fullName: row.fullName,
    })
  }
  if (input.status === "rejected" && existing?.status !== "rejected") {
    await emitGrowthLeadDecisionMakerTimeline(admin, {
      leadId,
      eventType: "decision_maker_rejected",
      decisionMakerId: row.id,
      fullName: row.fullName,
    })
  }
  return row
}

export async function deleteGrowthLeadDecisionMaker(
  admin: SupabaseClient,
  leadId: string,
  decisionMakerId: string,
): Promise<boolean> {
  const { data, error } = await decisionMakersTable(admin)
    .delete()
    .eq("lead_id", leadId)
    .eq("id", decisionMakerId)
    .select("id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data)
}

function candidateDedupeKey(candidate: GrowthDecisionMakerCandidate): string {
  const email = candidate.email?.trim().toLowerCase()
  if (email) return `email:${email}`
  return `name:${normalizeName(candidate.fullName)}`
}

export async function upsertGrowthLeadDecisionMakerCandidates(
  admin: SupabaseClient,
  input: {
    leadId: string
    candidates: GrowthDecisionMakerCandidate[]
    createdBy?: string | null
  },
): Promise<GrowthLeadDecisionMaker[]> {
  if (input.candidates.length === 0) return listGrowthLeadDecisionMakers(admin, input.leadId)

  const existing = await listGrowthLeadDecisionMakers(admin, input.leadId)
  const existingByKey = new Map(
    existing.map((row) => {
      const email = row.email?.trim().toLowerCase()
      const key = email ? `email:${email}` : `name:${normalizeName(row.fullName)}`
      return [key, row] as const
    }),
  )

  for (const candidate of input.candidates) {
    const fullName = candidate.fullName?.trim()
    if (!fullName) continue

    const key = candidateDedupeKey({ ...candidate, fullName })
    const existingRow = existingByKey.get(key)
    const incomingScore = decisionMakerCandidateScore({
      source: candidate.source,
      confidence: candidate.confidence ?? null,
    })

    if (existingRow) {
      const existingScore = decisionMakerCandidateScore({
        source: existingRow.source,
        confidence: existingRow.confidence,
      })
      if (incomingScore <= existingScore && existingRow.source !== "manual") continue

      await decisionMakersTable(admin)
        .update({
          full_name: fullName,
          title: trimOrNull(candidate.title) ?? existingRow.title,
          email: trimOrNull(candidate.email) ?? existingRow.email,
          phone: trimOrNull(candidate.phone) ?? existingRow.phone,
          linkedin_url: trimOrNull(candidate.linkedinUrl) ?? existingRow.linkedinUrl,
          source: incomingScore > existingScore ? candidate.source : existingRow.source,
          source_detail: trimOrNull(candidate.sourceDetail) ?? existingRow.sourceDetail,
          confidence: candidate.confidence ?? existingRow.confidence,
          evidence_excerpt: trimOrNull(candidate.evidenceExcerpt) ?? existingRow.evidenceExcerpt,
        })
        .eq("id", existingRow.id)
      continue
    }

    await createGrowthLeadDecisionMaker(admin, {
      leadId: input.leadId,
      fullName,
      title: candidate.title,
      email: candidate.email,
      phone: candidate.phone,
      linkedinUrl: candidate.linkedinUrl,
      source: candidate.source,
      sourceDetail: candidate.sourceDetail,
      confidence: candidate.confidence,
      evidenceExcerpt: candidate.evidenceExcerpt,
      status: "suspected",
      createdBy: input.createdBy ?? null,
    })
  }

  return listGrowthLeadDecisionMakers(admin, input.leadId)
}

export function computeDecisionMakerPresenceStatus(
  decisionMakers: GrowthLeadDecisionMaker[],
): GrowthDecisionMakerPresenceStatus {
  const active = decisionMakers.filter((dm) => dm.status !== "rejected")
  if (active.length === 0) return "none"

  const primary = active.find((dm) => dm.isPrimary) ?? active[0]
  const confirmed = active.some((dm) => dm.status === "confirmed")
  const contactable = active.some(
    (dm) => dm.status === "confirmed" && Boolean(dm.phone?.trim() || dm.email?.trim()),
  )

  if (contactable && (primary.status === "confirmed" || confirmed)) {
    return "verified_contactable"
  }
  if (confirmed) return "confirmed"
  return "suspected"
}

export async function recomputeGrowthLeadDecisionMakerStatus(
  admin: SupabaseClient,
  leadId: string,
): Promise<{ status: GrowthDecisionMakerPresenceStatus; primaryDecisionMakerId: string | null }> {
  const decisionMakers = await listGrowthLeadDecisionMakers(admin, leadId)
  const status = computeDecisionMakerPresenceStatus(decisionMakers)

  const ranked = [...decisionMakers]
    .filter((dm) => dm.status !== "rejected")
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      return (
        decisionMakerCandidateScore({ source: b.source, confidence: b.confidence }) -
        decisionMakerCandidateScore({ source: a.source, confidence: a.confidence })
      )
    })

  const primary = ranked[0] ?? null
  const primaryDecisionMakerId = primary?.id ?? null

  if (primary && !primary.isPrimary) {
    await decisionMakersTable(admin)
      .update({ is_primary: false })
      .eq("lead_id", leadId)
      .eq("is_primary", true)
    await decisionMakersTable(admin)
      .update({ is_primary: true })
      .eq("id", primary.id)
  }

  const { error } = await growthLeadsTable(admin)
    .update({
      decision_maker_status: status,
      primary_decision_maker_id: primaryDecisionMakerId,
    })
    .eq("id", leadId)

  if (error) throw new Error(error.message)

  logGrowthEngine("decision_maker_status_recomputed", {
    leadId,
    status,
    primaryDecisionMakerId,
    count: decisionMakers.length,
  })

  return { status, primaryDecisionMakerId }
}

export function buildLeadContactDecisionMakerCandidate(input: {
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
}): GrowthDecisionMakerCandidate | null {
  const fullName = input.contactName?.trim()
  if (!fullName) return null

  return {
    fullName,
    email: input.contactEmail,
    phone: input.contactPhone,
    source: "lead_contact",
    sourceDetail: "Primary lead contact",
    confidence: 0.55,
    evidenceExcerpt: "Lead contact on file",
  }
}
