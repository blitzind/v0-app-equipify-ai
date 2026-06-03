/** Client-safe Call Workspace live coaching types (Google Voice Bridge coaching fix). */

export const GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER = "google-voice-bridge-coaching-v1" as const

export const CALL_WORKSPACE_COACHING_MODES = ["lead_linked", "transcript_only"] as const
export type CallWorkspaceCoachingMode = (typeof CALL_WORKSPACE_COACHING_MODES)[number]

export const CALL_WORKSPACE_TRANSCRIPT_ONLY_COACHING_COPY =
  "No lead linked. Coaching will run using transcript-only guidance." as const

export const CALL_WORKSPACE_COACHING_NO_LEAD_COPY =
  "Lead not linked. Start coaching for transcript guidance only, or attach a lead for full intelligence." as const

export const CALL_WORKSPACE_COACHING_LINK_FAILED_COPY =
  "Live Coaching could not link to this call. Transcript guidance is unavailable until coaching connects." as const

export const CALL_WORKSPACE_MEDIA_STREAM_RESTART_FAILED_COPY =
  "Live transcript stream did not restart after answer. Retry media stream or check voice infrastructure logs." as const

export const CALL_WORKSPACE_ANSWER_RECONCILE_FAILED_COPY =
  "Your call connected, but workspace sync is still catching up. Coaching data may be delayed." as const

export const CALL_WORKSPACE_ENRICHMENT_SYNC_FAILED_COPY =
  "Live coaching and call intelligence are temporarily unavailable. Your call is still connected." as const

export type CallWorkspaceAnswerPipelineDiagnostics = {
  liveCoachingLinked: boolean
  /** True when coaching link + media stream continue on the server after a fast answer response. */
  coachingLinkPending: boolean
  realtimeSessionId: string | null
  createdRealtimeSessionId: string | null
  liveCoachingError: string | null
  liveCoachingFailureReason: string | null
  linkResult: LinkNativeCallRealtimeSessionResult | null
  mediaStreamStarted: boolean
  mediaStreamReason: string | null
  mediaStreamWssHost: string | null
}

export type LinkNativeCallRealtimeSessionResult =
  | {
      linked: true
      realtimeSessionId: string
      nativeSessionId: string
      reason: null
    }
  | {
      linked: false
      realtimeSessionId: string
      nativeSessionId: string
      reason:
        | "native_session_not_found"
        | "native_session_update_failed"
        | "realtime_session_not_persisted"
    }

export function emptyCallWorkspaceAnswerPipelineDiagnostics(): CallWorkspaceAnswerPipelineDiagnostics {
  return {
    liveCoachingLinked: false,
    coachingLinkPending: false,
    realtimeSessionId: null,
    createdRealtimeSessionId: null,
    liveCoachingError: null,
    liveCoachingFailureReason: null,
    linkResult: null,
    mediaStreamStarted: false,
    mediaStreamReason: null,
    mediaStreamWssHost: null,
  }
}

export const CALL_WORKSPACE_TRANSCRIPT_ANCHOR_METADATA_KEY = "call_workspace_transcript_anchor" as const

export function isCallWorkspaceTranscriptAnchorLead(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.[CALL_WORKSPACE_TRANSCRIPT_ANCHOR_METADATA_KEY] === true
}

export type CallWorkspacePhoneLeadMatch = {
  leadId: string
  matchedVia:
    | "growth_lead_contact_phone"
    | "growth_decision_maker_phone"
    | "growth_outbound_contact"
    | "growth_prospect_promoted"
    | "public_prospect_phone"
    | "customer_contact_phone"
    | "relationship_memory_lead"
  confidence: number
  label: string
}
