import {
  GROWTH_DRAWER_CARD_KEYS,
  GROWTH_DRAWER_CARD_PERSIST_PREFIX,
} from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  GROWTH_AVA_COGNITIVE_SECTION_IDS,
  GROWTH_AVA_RAW_INTELLIGENCE_FOCUS_TARGETS,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

export const GROWTH_COMMAND_LEAD_FOCUS_VALUES = [
  "command",
  "executive",
  "revenue",
  "conversation",
  "relationship",
  "capacity",
  "call-copilot",
  "realtime-call",
  "sequence",
  "ai-copilot",
  "decision-makers",
  "research",
  "meetings",
  "execution",
] as const

export type GrowthCommandLeadFocus = (typeof GROWTH_COMMAND_LEAD_FOCUS_VALUES)[number]

const FOCUS_CARD_KEY: Partial<
  Record<GrowthCommandLeadFocus, (typeof GROWTH_DRAWER_CARD_KEYS)[keyof typeof GROWTH_DRAWER_CARD_KEYS]>
> = {
  executive: GROWTH_DRAWER_CARD_KEYS.executive,
  revenue: GROWTH_DRAWER_CARD_KEYS.revenue,
  conversation: GROWTH_DRAWER_CARD_KEYS.conversation,
  relationship: GROWTH_DRAWER_CARD_KEYS.relationship,
  capacity: GROWTH_DRAWER_CARD_KEYS.capacity,
  "call-copilot": GROWTH_DRAWER_CARD_KEYS.callCopilot,
  "realtime-call": GROWTH_DRAWER_CARD_KEYS.realtimeCall,
  sequence: GROWTH_DRAWER_CARD_KEYS.sequence,
  "ai-copilot": GROWTH_DRAWER_CARD_KEYS.aiCopilot,
  "decision-makers": GROWTH_DRAWER_CARD_KEYS.decisionMakers,
  research: GROWTH_DRAWER_CARD_KEYS.research,
  meetings: GROWTH_DRAWER_CARD_KEYS.meetings,
}

export const GROWTH_COMMAND_FOCUS_SECTION_IDS: Partial<Record<GrowthCommandLeadFocus, string>> = {
  executive: "growth-executive",
  revenue: "growth-revenue",
  conversation: "growth-conversation",
  relationship: "growth-relationship",
  capacity: "growth-capacity",
  "call-copilot": "growth-call-copilot",
  "realtime-call": "growth-realtime-call",
  sequence: "growth-sequence",
  "ai-copilot": "growth-ai-copilot",
  "decision-makers": "growth-decision-makers",
  research: "growth-lead-research",
  meetings: "growth-meeting-intelligence",
  execution: "growth-execution-readiness",
}

const RAW_FOCUS_SET = new Set<string>(GROWTH_AVA_RAW_INTELLIGENCE_FOCUS_TARGETS)

export function applyGrowthCommandLeadFocusExpand(focus: string | null | undefined): void {
  if (!focus || typeof window === "undefined") return
  const cardKey = FOCUS_CARD_KEY[focus as GrowthCommandLeadFocus]
  if (cardKey) {
    try {
      localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${cardKey}`, "true")
    } catch {
      // ignore storage failures
    }
  }
  if (RAW_FOCUS_SET.has(focus) || focus === "decision-makers" || focus === "research") {
    try {
      localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}ava-cognitive-raw`, "true")
    } catch {
      // ignore
    }
  }
}

export function scrollGrowthCommandLeadFocusSection(focus: string | null | undefined): void {
  if (!focus || typeof document === "undefined") return
  const sectionId = GROWTH_COMMAND_FOCUS_SECTION_IDS[focus as GrowthCommandLeadFocus]
  const targetId =
    sectionId ?? (focus === "command" ? GROWTH_AVA_COGNITIVE_SECTION_IDS.assessment : null)
  if (!targetId) return
  requestAnimationFrame(() => {
    if (RAW_FOCUS_SET.has(focus) || focus === "decision-makers" || focus === "research") {
      document.getElementById(GROWTH_AVA_COGNITIVE_SECTION_IDS.raw_intelligence)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 120)
      return
    }
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
  })
}
