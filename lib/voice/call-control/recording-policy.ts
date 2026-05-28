import type { VoiceRecordingPolicy } from "@/lib/voice/call-control/types"
import type { VoiceCallDirection } from "@/lib/voice/types"

export function resolveEffectiveRecordingPolicy(input: {
  direction: VoiceCallDirection
  orgDefault: VoiceRecordingPolicy
  numberOverride?: VoiceRecordingPolicy | null
}): VoiceRecordingPolicy {
  return input.numberOverride ?? input.orgDefault
}

export function shouldRecordCall(input: {
  policy: VoiceRecordingPolicy
  direction: VoiceCallDirection
}): boolean {
  switch (input.policy) {
    case "all_calls":
      return true
    case "inbound_only":
      return input.direction === "inbound"
    case "outbound_only":
      return input.direction === "outbound"
    default:
      return false
  }
}

export function recordingPolicyComplianceMessage(): string {
  return "Recording disclosure workflows are scaffolding only — compliance is not complete in Phase 1C."
}
