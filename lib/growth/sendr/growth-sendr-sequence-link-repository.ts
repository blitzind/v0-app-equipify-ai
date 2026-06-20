import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import type { GrowthSendrSequencePageLink } from "@/lib/growth/sendr/growth-sendr-types"

function linksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_sendr_sequence_page_links")
}

function mapLink(row: Record<string, unknown>): GrowthSendrSequencePageLink {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    landingPageId: String(row.landing_page_id),
    sequencePatternId: String(row.sequence_pattern_id),
    sequencePatternStepId: row.sequence_pattern_step_id ? String(row.sequence_pattern_step_id) : null,
    enrollmentRunId: row.enrollment_run_id ? String(row.enrollment_run_id) : null,
    linkStatus: String(row.link_status) as GrowthSendrSequencePageLink["linkStatus"],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    attachedBy: row.attached_by ? String(row.attached_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function countSendrLinksForSequence(
  admin: SupabaseClient,
  sequencePatternId: string,
): Promise<number> {
  const { count, error } = await linksTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("sequence_pattern_id", sequencePatternId)
    .eq("link_status", "approved")
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}

export async function countSendrLinksForPage(
  admin: SupabaseClient,
  landingPageId: string,
): Promise<number> {
  const { count, error } = await linksTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("landing_page_id", landingPageId)
    .eq("link_status", "approved")
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}

export async function createSendrSequencePageLink(
  admin: SupabaseClient,
  input: {
    organizationId: string
    landingPageId: string
    sequencePatternId: string
    sequencePatternStepId?: string | null
    enrollmentRunId?: string | null
    attachedBy?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSendrSequencePageLink> {
  const seqCount = await countSendrLinksForSequence(admin, input.sequencePatternId)
  if (seqCount >= GROWTH_SENDR_LIMITS.MAX_SENDR_PAGE_ATTACHMENTS_PER_SEQUENCE) {
    throw new Error("sendr_sequence_link_cap_exceeded")
  }
  const pageCount = await countSendrLinksForPage(admin, input.landingPageId)
  if (pageCount >= GROWTH_SENDR_LIMITS.MAX_SENDR_SEQUENCE_LINKS_PER_PAGE) {
    throw new Error("sendr_page_link_cap_exceeded")
  }

  const { data, error } = await linksTable(admin)
    .insert({
      organization_id: input.organizationId,
      landing_page_id: input.landingPageId,
      sequence_pattern_id: input.sequencePatternId,
      sequence_pattern_step_id: input.sequencePatternStepId ?? null,
      enrollment_run_id: input.enrollmentRunId ?? null,
      link_status: "approved",
      metadata: input.metadata ?? {},
      attached_by: input.attachedBy ?? null,
      qa_marker: GROWTH_SENDR_SEQUENCE_BRIDGE_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapLink(data as Record<string, unknown>)
}

export async function listSendrSequencePageLinks(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sequencePatternId?: string
    landingPageId?: string
    limit?: number
  },
): Promise<GrowthSendrSequencePageLink[]> {
  const limit = Math.min(input.limit ?? 50, 100)
  let query = linksTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("link_status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (input.sequencePatternId) query = query.eq("sequence_pattern_id", input.sequencePatternId)
  if (input.landingPageId) query = query.eq("landing_page_id", input.landingPageId)
  const { data, error } = await query
  if (error?.message?.includes("does not exist")) return []
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapLink(row as Record<string, unknown>))
}

export async function resolveSendrLinkForSequenceStep(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sequencePatternStepId: string | null
    sequencePatternId?: string | null
  },
): Promise<GrowthSendrSequencePageLink | null> {
  if (input.sequencePatternStepId) {
    const { data, error } = await linksTable(admin)
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("sequence_pattern_step_id", input.sequencePatternStepId)
      .eq("link_status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error && data) return mapLink(data as Record<string, unknown>)
  }
  if (input.sequencePatternId) {
    const { data, error } = await linksTable(admin)
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("sequence_pattern_id", input.sequencePatternId)
      .eq("link_status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error && data) return mapLink(data as Record<string, unknown>)
  }
  return null
}

export async function countSendrLinksCreatedToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await linksTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}

export async function countDistinctSendrLinkedSequences(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { data, error } = await linksTable(admin)
    .select("sequence_pattern_id")
    .eq("organization_id", organizationId)
    .eq("link_status", "approved")
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return new Set((data ?? []).map((row) => String((row as Record<string, unknown>).sequence_pattern_id))).size
}

export async function countSendrTimelineEventsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", dayStart)
    .contains("payload", { source: "sendr_public_runtime" })
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}
