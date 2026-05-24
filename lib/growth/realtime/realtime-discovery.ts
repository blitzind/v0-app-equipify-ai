import type {
  GrowthRealtimeDiscoveryArea,
  GrowthRealtimeDiscoveryCoverage,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"

const DISCOVERY_RULES: Array<{ area: GrowthRealtimeDiscoveryArea; patterns: RegExp[] }> = [
  {
    area: "timeline_asked",
    patterns: [/\b(when|timeline|go live|target date|by when)\b/i, /\?\s*$/],
  },
  {
    area: "budget_asked",
    patterns: [/\b(budget|spend|investment|price range|cost)\b/i, /\?\s*$/],
  },
  {
    area: "implementation_asked",
    patterns: [/\b(implement|rollout|onboard|migration|training)\b/i, /\?\s*$/],
  },
  {
    area: "decision_maker_confirmed",
    patterns: [/\b(decision maker|who (else )?needs|sign.?off|approver|owner)\b/i],
  },
  {
    area: "current_solution_identified",
    patterns: [/\b(current(ly)? (use|using)|what (tool|system)|incumbent|vendor today)\b/i],
  },
]

function isRepQuestion(content: string): boolean {
  return content.includes("?") || /\b(what|how|when|who|why|tell me|walk me)\b/i.test(content)
}

export function computeRealtimeDiscoveryCoverage(
  events: Pick<GrowthRealtimeTranscriptEvent, "speaker" | "content">[],
): GrowthRealtimeDiscoveryCoverage {
  const covered = new Set<GrowthRealtimeDiscoveryArea>()

  for (const event of events) {
    if (event.speaker !== "rep") continue
    const text = event.content.trim()
    if (!text) continue

    for (const rule of DISCOVERY_RULES) {
      if (covered.has(rule.area)) continue
      const matches = rule.patterns.every((pattern) => pattern.test(text)) || isRepQuestion(text)
      if (matches && rule.patterns.some((pattern) => pattern.test(text))) {
        covered.add(rule.area)
      }
    }
  }

  const all = DISCOVERY_RULES.map((rule) => rule.area)
  const missing = all.filter((area) => !covered.has(area))
  return { covered: [...covered], missing }
}

export function discoveryGapMessages(missing: GrowthRealtimeDiscoveryArea[]): string[] {
  const labels: Record<GrowthRealtimeDiscoveryArea, string> = {
    timeline_asked: "Ask implementation timeline",
    budget_asked: "Budget discussion not covered",
    implementation_asked: "Implementation path not explored",
    decision_maker_confirmed: "Decision maker not confirmed",
    current_solution_identified: "Current solution not identified",
  }
  return missing.map((area) => labels[area])
}
