import {
  GROWTH_DRAWER_CARD_KEYS,
  GROWTH_DRAWER_CARD_PERSIST_PREFIX,
} from "@/lib/growth/growth-lead-drawer-stream-filters"

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
] as const

export type GrowthCommandLeadFocus = (typeof GROWTH_COMMAND_LEAD_FOCUS_VALUES)[number]

const FOCUS_CARD_KEY: Partial<Record<GrowthCommandLeadFocus, (typeof GROWTH_DRAWER_CARD_KEYS)[keyof typeof GROWTH_DRAWER_CARD_KEYS]>> = {
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
  research: "growth-research",
  meetings: "growth-meeting-intelligence",
}

export function applyGrowthCommandLeadFocusExpand(focus: string | null | undefined): void {
  if (!focus || typeof window === "undefined") return
  const cardKey = FOCUS_CARD_KEY[focus as GrowthCommandLeadFocus]
  if (!cardKey) return
  try {
    localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${cardKey}`, "true")
  } catch {
    // ignore storage failures
  }
}

export function scrollGrowthCommandLeadFocusSection(focus: string | null | undefined): void {
  if (!focus || typeof document === "undefined") return
  const sectionId = GROWTH_COMMAND_FOCUS_SECTION_IDS[focus as GrowthCommandLeadFocus]
  if (!sectionId) return
  requestAnimationFrame(() => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" })
  })
}
