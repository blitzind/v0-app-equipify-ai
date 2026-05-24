export type RealtimeTranscriptChunk = {
  speaker: "rep" | "prospect" | "system"
  content: string
  timestampMs: number
  isFinal: boolean
}

export type RealtimeTranscriptProviderHealth = {
  ok: boolean
  providerId: string
  mode: "stub" | "live"
  message: string
}
