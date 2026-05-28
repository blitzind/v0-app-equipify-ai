export type VoiceOptOutSource = "manual" | "operator" | "webhook" | "import"

export type VoiceOptOutRecord = {
  organizationId: string
  phoneNumber: string
  reason: string
  source: VoiceOptOutSource
  createdAt: string
}

export function isVoiceOptOutSource(value: string): value is VoiceOptOutSource {
  return value === "manual" || value === "operator" || value === "webhook" || value === "import"
}
