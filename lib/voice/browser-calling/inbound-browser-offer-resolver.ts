import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  compareVoiceCallRecency,
  isTerminalVoiceCallStatus,
  isVoiceCallOfferable,
} from "@/lib/voice/browser-calling/call-lifecycle-reconciliation"
import type { VoiceInboundBrowserOfferView } from "@/lib/voice/browser-calling/types"

const RINGING_SESSION_CANDIDATE_LIMIT = 12

export type InboundBrowserOfferCandidate = {
  workspaceSessionId: string
  voiceCallId: string
  providerCallId: string | null
  voiceCallStatus: string | null
  voiceCallCreatedAt: string | null
  sessionStartedAt: string | null
  excludedReason: string | null
}

export type InboundBrowserOfferSelection = {
  offer: VoiceInboundBrowserOfferView | null
  selectionReason: string
  candidateCount: number
  selectedVoiceCallId: string | null
  selectedProviderCallId: string | null
  selectedVoiceCallCreatedAt: string | null
  selectedVoiceCallStatus: string | null
  candidates: InboundBrowserOfferCandidate[]
}

function sessionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("native_call_workspace_sessions")
}

export async function resolveInboundBrowserOfferForUser(
  admin: SupabaseClient,
  input: { organizationId: string; userId: string },
): Promise<InboundBrowserOfferSelection> {
  const { data: sessions, error } = await sessionsTable(admin)
    .select("id, voice_call_id, phone_number, contact_name, started_at, owner_user_id, status, direction")
    .eq("organization_id", input.organizationId)
    .eq("owner_user_id", input.userId)
    .eq("direction", "inbound")
    .eq("status", "ringing")
    .order("started_at", { ascending: false })
    .limit(RINGING_SESSION_CANDIDATE_LIMIT)

  if (error) throw new Error(error.message)

  const sessionRows = sessions ?? []
  if (sessionRows.length === 0) {
    return {
      offer: null,
      selectionReason: "no_ringing_sessions",
      candidateCount: 0,
      selectedVoiceCallId: null,
      selectedProviderCallId: null,
      selectedVoiceCallCreatedAt: null,
      selectedVoiceCallStatus: null,
      candidates: [],
    }
  }

  const voiceCallIds = [
    ...new Set(
      sessionRows
        .map((row) => row.voice_call_id as string | null)
        .filter((value): value is string => Boolean(value)),
    ),
  ]

  const { data: callRows, error: callError } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("id, provider_call_id, from_number, to_number, started_at, status, answered_at")
    .in("id", voiceCallIds)

  if (callError) throw new Error(callError.message)

  const callById = new Map((callRows ?? []).map((row) => [String(row.id), row]))

  const candidates: InboundBrowserOfferCandidate[] = sessionRows
    .filter((row) => Boolean(row.voice_call_id))
    .map((row) => {
      const voiceCallId = String(row.voice_call_id)
      const callRow = callById.get(voiceCallId)
      const offerable = callRow
        ? isVoiceCallOfferable({
            status: callRow.status as string | null,
            answeredAt: (callRow.answered_at as string | null) ?? null,
          })
        : false
      const status = (callRow?.status as string | null) ?? null
      const answeredAt = (callRow?.answered_at as string | null) ?? null
      let excludedReason: string | null = null
      if (!callRow) {
        excludedReason = "voice_call_missing"
      } else if (!offerable) {
        if (answeredAt) excludedReason = "voice_call_answered"
        else if (status === "in_progress") excludedReason = "voice_call_in_progress"
        else if (isTerminalVoiceCallStatus(status)) excludedReason = "voice_call_terminal"
        else excludedReason = "voice_call_not_ringing"
      }
      return {
        workspaceSessionId: String(row.id),
        voiceCallId,
        providerCallId: (callRow?.provider_call_id as string | null) ?? null,
        voiceCallStatus: status,
        voiceCallCreatedAt: (callRow?.started_at as string | null) ?? null,
        sessionStartedAt: (row.started_at as string | null) ?? null,
        excludedReason,
      }
    })
    .sort((left, right) => {
      const byVoiceCreatedAt = compareVoiceCallRecency(
        left.voiceCallCreatedAt,
        right.voiceCallCreatedAt,
      )
      if (byVoiceCreatedAt !== 0) return byVoiceCreatedAt
      return (
        parseVoiceCallTimestamp(right.sessionStartedAt) - parseVoiceCallTimestamp(left.sessionStartedAt)
      )
    })

  const selectedCandidate = candidates.find((candidate) => candidate.excludedReason === null) ?? null
  if (!selectedCandidate) {
    return {
      offer: null,
      selectionReason: "no_offerable_candidates",
      candidateCount: candidates.length,
      selectedVoiceCallId: null,
      selectedProviderCallId: null,
      selectedVoiceCallCreatedAt: null,
      selectedVoiceCallStatus: null,
      candidates,
    }
  }

  const selectedCallRow = callById.get(selectedCandidate.voiceCallId)
  const selectedSession = sessionRows.find((row) => String(row.id) === selectedCandidate.workspaceSessionId)

  return {
    offer: {
      voiceCallId: selectedCandidate.voiceCallId,
      workspaceSessionId: selectedCandidate.workspaceSessionId,
      fromNumber:
        (selectedCallRow?.from_number as string | null) ??
        (selectedSession?.phone_number as string | null) ??
        "Unknown",
      toNumber: (selectedCallRow?.to_number as string | null) ?? "Unknown",
      contactLabel: (selectedSession?.contact_name as string | null) ?? null,
      offeredAt: (selectedSession?.started_at as string) ?? new Date().toISOString(),
      voiceCallCreatedAt: selectedCandidate.voiceCallCreatedAt,
    },
    selectionReason: "newest_offerable_voice_call",
    candidateCount: candidates.length,
    selectedVoiceCallId: selectedCandidate.voiceCallId,
    selectedProviderCallId: selectedCandidate.providerCallId,
    selectedVoiceCallCreatedAt: selectedCandidate.voiceCallCreatedAt,
    selectedVoiceCallStatus: selectedCandidate.voiceCallStatus,
    candidates,
  }
}

export async function closeRingingSessionWhenVoiceCallEnded(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workspaceSessionId: string
    voiceCallStatus: string | null | undefined
  },
): Promise<void> {
  const status = (input.voiceCallStatus ?? "").trim()
  if (!isTerminalVoiceCallStatus(status)) return
  const nativeStatus =
    status === "no_answer" || status === "busy" ? "no_answer" : status === "canceled" ? "cancelled" : "missed"
  await sessionsTable(admin)
    .update({
      status: nativeStatus,
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.workspaceSessionId)
    .eq("status", "ringing")
}

function parseVoiceCallTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function reconcileStaleRingingOfferCandidates(
  admin: SupabaseClient,
  input: {
    organizationId: string
    candidates: InboundBrowserOfferCandidate[]
  },
): Promise<number> {
  let closedCount = 0
  for (const candidate of input.candidates) {
    if (
      candidate.excludedReason !== "voice_call_terminal" &&
      candidate.excludedReason !== "voice_call_answered" &&
      candidate.excludedReason !== "voice_call_in_progress"
    ) {
      continue
    }
    await closeRingingSessionWhenVoiceCallEnded(admin, {
      organizationId: input.organizationId,
      workspaceSessionId: candidate.workspaceSessionId,
      voiceCallStatus: candidate.voiceCallStatus,
    })
    closedCount += 1
  }
  return closedCount
}
