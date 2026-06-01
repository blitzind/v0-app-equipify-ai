import type {
  GrowthRealtimeBuyingSignalKey,
  GrowthRealtimeDetectedBuyingSignal,
} from "@/lib/growth/realtime/realtime-call-types"

const BUYING_RULES: Array<{ key: GrowthRealtimeBuyingSignalKey; label: string; pattern: RegExp }> = [
  { key: "buying_signal", label: "Buying signal", pattern: /\b(interested|learn more|tell me more|sounds good|makes sense)\b/i },
  { key: "pricing_interest", label: "Pricing interest", pattern: /\b(pricing|quote|proposal|how much|cost breakdown)\b/i },
  { key: "implementation_signal", label: "Implementation signal", pattern: /\b(implement|rollout|onboard|migration|go live)\b/i },
  { key: "timeline_urgency", label: "Timeline urgency", pattern: /\b(asap|urgent|this week|deadline|soon|timeline)\b/i },
  {
    key: "commitment_language",
    label: "Commitment language",
    pattern: /\b(move forward|next step|sign|contract|schedule|send over|let's do)\b/i,
  },
  {
    key: "decision_maker_confirmed",
    label: "Decision maker confirmed",
    pattern: /\b(i (decide|approve|sign)|decision maker|owner here|i'm the (owner|director|vp))\b/i,
  },
]

export function detectRealtimeBuyingSignals(input: {
  content: string
  sequenceNumber: number
  speaker: "rep" | "prospect" | "system"
}): GrowthRealtimeDetectedBuyingSignal[] {
  if (input.speaker === "system") return []
  const text = input.content.trim()
  if (!text) return []

  const found: GrowthRealtimeDetectedBuyingSignal[] = []
  const seen = new Set<GrowthRealtimeBuyingSignalKey>()

  for (const rule of BUYING_RULES) {
    if (rule.pattern.test(text) && !seen.has(rule.key)) {
      seen.add(rule.key)
      found.push({
        key: rule.key,
        label: rule.label,
        excerpt: text.slice(0, 160),
        sequenceNumber: input.sequenceNumber,
      })
    }
  }

  return found
}

export function mergeRealtimeBuyingSignals(
  events: Array<{ content: string; sequenceNumber: number; speaker: "rep" | "prospect" | "system" }>,
): GrowthRealtimeDetectedBuyingSignal[] {
  const byKey = new Map<string, GrowthRealtimeDetectedBuyingSignal>()
  for (const event of events) {
    for (const signal of detectRealtimeBuyingSignals(event)) {
      if (!byKey.has(signal.key)) byKey.set(signal.key, signal)
    }
  }
  return [...byKey.values()]
}
