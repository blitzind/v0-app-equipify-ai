export type RealtimeTranscriptChunk = {
  speaker: "rep" | "prospect" | "system"
  content: string
  timestampMs: number
  isFinal: boolean
  confidence?: number
  keywords?: string[]
}

export type RealtimeTranscriptProviderHealth = {
  ok: boolean
  providerId: string
  mode: "stub" | "live"
  message: string
  latencyMs?: number
}
