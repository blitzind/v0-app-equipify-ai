/** Map voice transcript speaker labels to Growth realtime speakers. Client-safe. */

import type { GrowthRealtimeCallSpeaker } from "@/lib/growth/realtime/realtime-call-types"

export function mapVoiceSpeakerToGrowthRealtime(speakerType: string): GrowthRealtimeCallSpeaker {
  const normalized = speakerType.trim().toLowerCase()
  if (normalized === "operator" || normalized === "rep" || normalized === "agent") return "rep"
  if (normalized === "customer" || normalized === "prospect" || normalized === "caller") return "prospect"
  if (normalized === "system") return "system"
  return "prospect"
}
