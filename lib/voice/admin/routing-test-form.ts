import type { VoiceNumberListItem } from "@/lib/voice/types"

export type RoutingTestRequestInput = {
  voiceNumberId: string
  fromNumber: string
  skipRoundRobinAdvance?: boolean
}

/** Prefer explicit input; fall back to first loaded voice number (never HTML placeholder). */
export function resolveRoutingTestVoiceNumberId(
  stateValue: string,
  numbers: Pick<VoiceNumberListItem, "id">[],
): string {
  const trimmed = stateValue.trim()
  if (trimmed) return trimmed
  return numbers[0]?.id?.trim() ?? ""
}

export function buildRoutingTestRequestBody(input: RoutingTestRequestInput): {
  voiceNumberId: string
  fromNumber: string
  skipRoundRobinAdvance: boolean
} {
  return {
    voiceNumberId: input.voiceNumberId.trim(),
    fromNumber: input.fromNumber.trim(),
    skipRoundRobinAdvance: input.skipRoundRobinAdvance ?? true,
  }
}

export function initialRoutingTestVoiceNumberId(numbers: Pick<VoiceNumberListItem, "id">[]): string {
  return numbers[0]?.id?.trim() ?? ""
}
