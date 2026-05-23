import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import { recordGrowthLeadCallEvent } from "@/lib/growth/call-events-repository"
import type { GrowthCallDialMode, GrowthLeadCallSession } from "@/lib/growth/communication/types"
import { emitGrowthLeadCallStartedTimeline } from "@/lib/growth/timeline-emitter"

type SessionDbRow = {
  id: string
  lead_id: string
  phone_dialed: string
  dial_mode: string
  started_at: string
  ended_at: string | null
  disposition: string | null
  call_event_id: string | null
  created_by: string | null
  created_at: string
}

const SELECT =
  "id, lead_id, phone_dialed, dial_mode, started_at, ended_at, disposition, call_event_id, created_by, created_at"

function sessionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_call_sessions")
}

function mapRow(row: SessionDbRow): GrowthLeadCallSession {
  return {
    id: row.id,
    leadId: row.lead_id,
    phoneDialed: row.phone_dialed,
    dialMode: row.dial_mode as GrowthCallDialMode,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    disposition: row.disposition,
    callEventId: row.call_event_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export async function startGrowthLeadCallSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    phoneDialed: string
    dialMode: GrowthCallDialMode
    createdBy: string
    actorEmail?: string | null
  },
): Promise<GrowthLeadCallSession> {
  const { data, error } = await sessionsTable(admin)
    .insert({
      lead_id: input.leadId,
      phone_dialed: input.phoneDialed.trim(),
      dial_mode: input.dialMode,
      created_by: input.createdBy,
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)

  const session = mapRow(data as SessionDbRow)

  await emitGrowthLeadCallStartedTimeline(admin, {
    leadId: input.leadId,
    sessionId: session.id,
    phoneDialed: session.phoneDialed,
    dialMode: session.dialMode,
    actor: { userId: input.createdBy, email: input.actorEmail },
  })

  logGrowthEngine("call_session_started", {
    leadId: input.leadId,
    sessionId: session.id,
    dialMode: input.dialMode,
  })

  return session
}

export async function closeGrowthLeadCallSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    disposition: GrowthLeadCallDisposition
    note?: string | null
    followUpAt?: string | null
    createdBy: string
    actorEmail?: string | null
  },
): Promise<{ session: GrowthLeadCallSession; lead: Awaited<ReturnType<typeof recordGrowthLeadCallEvent>>["lead"] }> {
  const { data: existing, error: fetchError } = await sessionsTable(admin)
    .select(SELECT)
    .eq("id", input.sessionId)
    .eq("lead_id", input.leadId)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error("not_found")
  if ((existing as SessionDbRow).ended_at) throw new Error("session_closed")

  const { event, lead } = await recordGrowthLeadCallEvent(admin, {
    leadId: input.leadId,
    disposition: input.disposition,
    note: input.note,
    followUpAt: input.followUpAt,
    createdBy: input.createdBy,
  })

  const now = new Date().toISOString()
  const { data, error } = await sessionsTable(admin)
    .update({
      ended_at: now,
      disposition: input.disposition,
      call_event_id: event.id,
    })
    .eq("id", input.sessionId)
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)

  logGrowthEngine("call_session_closed", {
    leadId: input.leadId,
    sessionId: input.sessionId,
    disposition: input.disposition,
    callEventId: event.id,
  })

  return { session: mapRow(data as SessionDbRow), lead }
}

export async function fetchGrowthLeadCallSessionById(
  admin: SupabaseClient,
  leadId: string,
  sessionId: string,
): Promise<GrowthLeadCallSession | null> {
  const { data, error } = await sessionsTable(admin)
    .select(SELECT)
    .eq("id", sessionId)
    .eq("lead_id", leadId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as SessionDbRow) : null
}
