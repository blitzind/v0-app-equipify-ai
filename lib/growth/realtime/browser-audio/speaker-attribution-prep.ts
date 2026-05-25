/** Speaker attribution pipeline prep — no diarization yet (Growth Engine slice 6.21A). */

export const GROWTH_SPEAKER_SOURCE_KEYS = ["local_user", "remote_participant", "unknown"] as const

export type GrowthSpeakerSource = (typeof GROWTH_SPEAKER_SOURCE_KEYS)[number]

export type GrowthSpeakerAttributionPrep = {
  speakerSource: GrowthSpeakerSource
  captureSourceMode: string | null
  meetingProvider: string | null
  mixedAudioEnabled: boolean
}

export function buildSpeakerAttributionPrep(input: {
  captureSourceMode: string | null
  meetingProvider: string | null
  mixedAudioEnabled: boolean
  localSpeakerHint?: GrowthSpeakerSource
}): GrowthSpeakerAttributionPrep {
  const speakerSource =
    input.localSpeakerHint ??
    (input.captureSourceMode === "microphone" ? "local_user" : "unknown")

  return {
    speakerSource,
    captureSourceMode: input.captureSourceMode,
    meetingProvider: input.meetingProvider,
    mixedAudioEnabled: input.mixedAudioEnabled,
  }
}
