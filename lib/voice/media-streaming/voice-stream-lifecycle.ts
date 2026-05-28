/** Deterministic voice stream lifecycle — Phase 1B foundation. Client-safe types. */

export const VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER =
  "voice-media-streaming-foundation-v1" as const

export const VOICE_STREAM_LIFECYCLE_STATES = [
  "initiated",
  "ringing",
  "connected",
  "streaming",
  "transcribing",
  "disconnecting",
  "completed",
  "failed",
] as const

export type VoiceStreamLifecycleState = (typeof VOICE_STREAM_LIFECYCLE_STATES)[number]

export type VoiceStreamLifecycleSnapshot = {
  qaMarker: typeof VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER
  state: VoiceStreamLifecycleState
  callSid: string | null
  streamSid: string | null
  mediaSessionId: string | null
  transcriptSessionId: string | null
  startedAt: string | null
  connectedAt: string | null
  streamingAt: string | null
  transcribingAt: string | null
  disconnectReason: string | null
  transcriptReady: boolean
  latencyMs: number | null
}

const VALID_TRANSITIONS: Record<VoiceStreamLifecycleState, VoiceStreamLifecycleState[]> = {
  initiated: ["ringing", "connected", "failed"],
  ringing: ["connected", "streaming", "failed", "disconnecting"],
  connected: ["streaming", "transcribing", "failed", "disconnecting"],
  streaming: ["transcribing", "disconnecting", "failed", "completed"],
  transcribing: ["streaming", "disconnecting", "failed", "completed"],
  disconnecting: ["completed", "failed"],
  completed: [],
  failed: [],
}

export function canTransitionVoiceStreamLifecycle(
  from: VoiceStreamLifecycleState,
  to: VoiceStreamLifecycleState,
): boolean {
  if (from === to) return true
  return VALID_TRANSITIONS[from].includes(to)
}

export function transitionVoiceStreamLifecycle(
  current: VoiceStreamLifecycleSnapshot,
  nextState: VoiceStreamLifecycleState,
  patch: Partial<
    Pick<
      VoiceStreamLifecycleSnapshot,
      | "callSid"
      | "streamSid"
      | "mediaSessionId"
      | "transcriptSessionId"
      | "disconnectReason"
      | "transcriptReady"
      | "latencyMs"
    >
  > = {},
): VoiceStreamLifecycleSnapshot {
  if (!canTransitionVoiceStreamLifecycle(current.state, nextState)) {
    return { ...current, state: "failed", disconnectReason: `invalid_transition:${current.state}->${nextState}` }
  }

  const now = new Date().toISOString()
  return {
    ...current,
    ...patch,
    state: nextState,
    connectedAt: nextState === "connected" && !current.connectedAt ? now : current.connectedAt,
    streamingAt: nextState === "streaming" && !current.streamingAt ? now : current.streamingAt,
    transcribingAt: nextState === "transcribing" && !current.transcribingAt ? now : current.transcribingAt,
  }
}

export function createInitialVoiceStreamLifecycleSnapshot(input?: {
  callSid?: string | null
}): VoiceStreamLifecycleSnapshot {
  return {
    qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
    state: "initiated",
    callSid: input?.callSid ?? null,
    streamSid: null,
    mediaSessionId: null,
    transcriptSessionId: null,
    startedAt: new Date().toISOString(),
    connectedAt: null,
    streamingAt: null,
    transcribingAt: null,
    disconnectReason: null,
    transcriptReady: false,
    latencyMs: null,
  }
}
