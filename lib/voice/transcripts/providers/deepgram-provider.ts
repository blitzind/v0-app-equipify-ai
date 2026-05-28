import type {
  TranscriptProviderAppendResult,
  TranscriptProviderFinalizeResult,
  TranscriptProviderStartInput,
  TranscriptProviderStartResult,
  VoiceTranscriptProvider,
} from "@/lib/voice/transcripts/providers/types"
import type { VoiceSpeakerType } from "@/lib/voice/media-streaming/types"

function mapGenericSpeaker(rawSpeaker: unknown): { speakerIdentity: string; speakerType: VoiceSpeakerType } {
  const value = String(rawSpeaker ?? "unknown").toLowerCase()
  if (value.includes("operator") || value.includes("agent") || value.includes("rep")) {
    return { speakerIdentity: value, speakerType: "operator" }
  }
  if (value.includes("customer") || value.includes("prospect") || value.includes("caller")) {
    return { speakerIdentity: value, speakerType: "customer" }
  }
  if (value.includes("supervisor")) return { speakerIdentity: value, speakerType: "supervisor" }
  if (value.includes("system")) return { speakerIdentity: value, speakerType: "system" }
  return { speakerIdentity: value || "unknown", speakerType: "unknown" }
}

function createBaseProvider(kind: VoiceTranscriptProvider["kind"], displayName: string): VoiceTranscriptProvider {
  return {
    kind,
    displayName,
    stubMode: true,
    async startTranscriptSession(input: TranscriptProviderStartInput): Promise<TranscriptProviderStartResult> {
      return {
        ok: true,
        providerSessionRef: `${kind}_stub:${input.mediaSessionId}`,
        message: `${displayName} transcript session scaffold started (stub mode).`,
      }
    },
    async appendTranscriptSegment(providerSessionRef: string, rawEvent: unknown): Promise<TranscriptProviderAppendResult> {
      const normalized = this.normalizeTranscriptEvent(rawEvent)
      if (!normalized) {
        return { ok: false, normalized: null, message: "Could not normalize transcript event." }
      }
      return {
        ok: true,
        normalized: { ...normalized, metadata: { ...(normalized.metadata ?? {}), providerSessionRef } },
        message: "Transcript segment normalized.",
      }
    },
    async finalizeTranscript(): Promise<TranscriptProviderFinalizeResult> {
      return { ok: true, finalStatus: "completed", message: `${displayName} transcript finalized (stub).` }
    },
    mapSpeaker: mapGenericSpeaker,
    normalizeTranscriptEvent(rawEvent: unknown) {
      if (!rawEvent || typeof rawEvent !== "object") return null
      const event = rawEvent as Record<string, unknown>
      const text = String(event.transcript ?? event.text ?? event.transcript_text ?? "").trim()
      if (!text) return null
      const speaker = mapGenericSpeaker(event.speaker ?? event.speaker_identity ?? event.channel)
      const confidenceRaw = event.confidence ?? event.confidence_score
      const confidence =
        typeof confidenceRaw === "number"
          ? confidenceRaw
          : typeof confidenceRaw === "string"
            ? Number.parseFloat(confidenceRaw)
            : null
      return {
        speakerIdentity: speaker.speakerIdentity,
        speakerType: speaker.speakerType,
        transcriptText: text,
        confidenceScore: Number.isFinite(confidence) ? confidence : null,
        startedAt: typeof event.started_at === "string" ? event.started_at : null,
        endedAt: typeof event.ended_at === "string" ? event.ended_at : null,
        isFinal: Boolean(event.is_final ?? event.final ?? true),
        providerEventId: typeof event.event_id === "string" ? event.event_id : undefined,
        metadata: { provider: kind },
      }
    },
  }
}

export function createDeepgramTranscriptProvider(): VoiceTranscriptProvider {
  const hasKey = Boolean(process.env.DEEPGRAM_API_KEY?.trim())
  const provider = createBaseProvider("deepgram", "Deepgram")
  return {
    ...provider,
    stubMode: !hasKey,
    async startTranscriptSession(input) {
      if (!hasKey) return provider.startTranscriptSession(input)
      return {
        ok: true,
        providerSessionRef: `deepgram:${input.mediaSessionId}`,
        message: "Deepgram realtime transcript session scaffold ready.",
      }
    },
  }
}

export function createAssemblyAiTranscriptProvider(): VoiceTranscriptProvider {
  const hasKey = Boolean(process.env.ASSEMBLYAI_API_KEY?.trim())
  const provider = createBaseProvider("assemblyai", "AssemblyAI")
  return {
    ...provider,
    stubMode: !hasKey,
    async startTranscriptSession(input) {
      if (!hasKey) return provider.startTranscriptSession(input)
      return {
        ok: true,
        providerSessionRef: `assemblyai:${input.mediaSessionId}`,
        message: "AssemblyAI streaming transcript session scaffold ready.",
      }
    },
  }
}

export function createOpenAiRealtimeTranscriptPlaceholder(): VoiceTranscriptProvider {
  const provider = createBaseProvider("openai_realtime", "OpenAI Realtime")
  return {
    ...provider,
    stubMode: true,
    async startTranscriptSession(input) {
      return {
        ok: true,
        providerSessionRef: `openai_realtime_placeholder:${input.mediaSessionId}`,
        message: "OpenAI Realtime transcript placeholder — future AI overlay only.",
      }
    },
  }
}

export function createStubTranscriptProvider(): VoiceTranscriptProvider {
  return createBaseProvider("stub", "Stub")
}

export function createNoneTranscriptProvider(): VoiceTranscriptProvider {
  const provider = createBaseProvider("none", "None")
  return {
    ...provider,
    async startTranscriptSession() {
      return { ok: true, providerSessionRef: null, message: "Transcript ingestion disabled." }
    },
    normalizeTranscriptEvent() {
      return null
    },
  }
}
