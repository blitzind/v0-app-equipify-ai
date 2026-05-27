import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type CallMeetingIntelligenceSummary = {
  meetingsBooked: number
  meetingsAttended: number
  meetingsNoShow: number
  connectedCallCount: number
  totalCallDurationSeconds: number
  objectionHeavyCallCount: number
  positiveSentimentIndicators: string[]
  followUpCommitments: string[]
  evidence: string[]
}

const POSITIVE_DISPOSITIONS = new Set(["interested", "follow_up_later", "meeting_booked"])
const OBJECTION_DISPOSITIONS = new Set(["not_a_fit", "gatekeeper", "voicemail"])

export async function loadCallMeetingIntelligenceForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<CallMeetingIntelligenceSummary> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const evidence: string[] = []
  const positiveSentimentIndicators: string[] = []
  const followUpCommitments: string[] = []

  const [callsRes, meetingsRes, copilotRes] = await Promise.all([
    admin
      .schema("growth")
      .from("lead_call_events")
      .select("disposition, note, follow_up_at, created_at")
      .eq("lead_id", leadId)
      .gte("created_at", since),
    admin
      .schema("growth")
      .from("meetings")
      .select("status, outcome, next_action, no_show_at, completed_at, created_at")
      .eq("lead_id", leadId)
      .gte("created_at", since)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[], error: null })),
    admin
      .schema("growth")
      .from("call_copilot_sessions")
      .select("detected_objections, detected_buying_signals, recommended_next_step, post_call_summary, created_at")
      .eq("lead_id", leadId)
      .gte("created_at", since)
      .limit(10)
      .then((r) => r)
      .catch(() => ({ data: [] as unknown[], error: null })),
  ])

  let connectedCallCount = 0
  let objectionHeavyCallCount = 0
  for (const row of callsRes.data ?? []) {
    const record = row as Record<string, unknown>
    const disposition = String(record.disposition ?? "")
    if (disposition !== "no_answer" && disposition !== "voicemail") connectedCallCount += 1
    if (OBJECTION_DISPOSITIONS.has(disposition)) objectionHeavyCallCount += 1
    if (POSITIVE_DISPOSITIONS.has(disposition)) {
      positiveSentimentIndicators.push(`Call disposition: ${disposition}`)
      if (record.note) evidence.push(String(record.note).slice(0, 200))
    }
    if (record.follow_up_at) {
      followUpCommitments.push(`Follow-up scheduled ${String(record.follow_up_at).slice(0, 10)}`)
    }
  }

  let meetingsBooked = 0
  let meetingsAttended = 0
  let meetingsNoShow = 0
  for (const row of meetingsRes.data ?? []) {
    const record = row as Record<string, unknown>
    const status = String(record.status ?? "")
    if (["scheduled", "confirmed", "completed", "no_show"].includes(status)) meetingsBooked += 1
    if (status === "completed") {
      meetingsAttended += 1
      if (record.outcome) evidence.push(`Meeting outcome: ${String(record.outcome)}`)
      if (record.next_action) followUpCommitments.push(String(record.next_action))
    }
    if (status === "no_show" || record.no_show_at) meetingsNoShow += 1
  }

  for (const row of copilotRes.data ?? []) {
    const record = row as Record<string, unknown>
    const objections = Array.isArray(record.detected_objections) ? record.detected_objections : []
    const buyingSignals = Array.isArray(record.detected_buying_signals) ? record.detected_buying_signals : []
    if (objections.length >= 2) objectionHeavyCallCount += 1
    for (const signal of buyingSignals.slice(0, 3)) {
      if (typeof signal === "string") positiveSentimentIndicators.push(`Call copilot signal (AI-assisted): ${signal}`)
    }
    if (record.recommended_next_step) followUpCommitments.push(String(record.recommended_next_step))
    if (record.post_call_summary) evidence.push(String(record.post_call_summary).slice(0, 200))
  }

  let totalCallDurationSeconds = 0
  const sessionsResult = await admin
    .schema("growth")
    .from("realtime_call_sessions")
    .select("started_at, ended_at")
    .eq("lead_id", leadId)
    .gte("started_at", since)
    .then((r) => r)
    .catch(() => ({ data: [] as unknown[] }))

  for (const row of sessionsResult.data ?? []) {
    const record = row as Record<string, unknown>
    if (record.started_at && record.ended_at) {
      const durationMs = new Date(String(record.ended_at)).getTime() - new Date(String(record.started_at)).getTime()
      if (durationMs > 0) totalCallDurationSeconds += Math.round(durationMs / 1000)
    }
  }
  if (totalCallDurationSeconds > 0) {
    evidence.push(`Recorded call duration: ${Math.round(totalCallDurationSeconds / 60)} minutes.`)
  }

  return {
    meetingsBooked,
    meetingsAttended,
    meetingsNoShow,
    connectedCallCount,
    totalCallDurationSeconds,
    objectionHeavyCallCount,
    positiveSentimentIndicators: [...new Set(positiveSentimentIndicators)].slice(0, 8),
    followUpCommitments: [...new Set(followUpCommitments)].slice(0, 8),
    evidence: evidence.slice(0, 10),
  }
}
