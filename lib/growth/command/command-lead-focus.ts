import {
  GROWTH_DRAWER_CARD_KEYS,
  GROWTH_DRAWER_CARD_PERSIST_PREFIX,
} from "@/lib/growth/growth-lead-drawer-stream-filters"
import { GROWTH_AVA_COGNITIVE_SECTION_IDS } from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"
import {
  resolveAvaRawDomainPersistKey,
  resolveCognitiveDomainFromFocus,
} from "@/lib/growth/cognitive-workspace/growth-cognitive-raw-domain-resolver"

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

const CARD_KEYS = GROWTH_DRAWER_CARD_KEYS ?? ({} as typeof GROWTH_DRAWER_CARD_KEYS)

const FOCUS_CARD_KEY: Partial<
  Record<GrowthCommandLeadFocus, (typeof GROWTH_DRAWER_CARD_KEYS)[keyof typeof GROWTH_DRAWER_CARD_KEYS]>
> = {
  executive: CARD_KEYS.executive,
  revenue: CARD_KEYS.revenue,
  conversation: CARD_KEYS.conversation,
  relationship: CARD_KEYS.relationship,
  capacity: CARD_KEYS.capacity,
  "call-copilot": CARD_KEYS.callCopilot,
  "realtime-call": CARD_KEYS.realtimeCall,
  sequence: CARD_KEYS.sequence,
  "ai-copilot": CARD_KEYS.aiCopilot,
  "decision-makers": CARD_KEYS.decisionMakers,
  research: CARD_KEYS.research,
  meetings: CARD_KEYS.meetings,
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

/** @deprecated Use resolveCognitiveDomainFromFocus — kept for call-site compatibility. */
export function resolveAvaRawDomainForFocus(focus: string | null | undefined) {
  return resolveCognitiveDomainFromFocus(focus)
}

function shouldExpandRawForFocus(focus: string): boolean {
  return resolveCognitiveDomainFromFocus(focus) != null || focus === "decision-makers" || focus === "research"
}

export function applyGrowthCommandLeadFocusExpand(focus: string | null | undefined): void {
  if (!focus || typeof window === "undefined") return
  const trimmed = String(focus).trim()
  if (!trimmed) return

  const cardKey = FOCUS_CARD_KEY[trimmed as GrowthCommandLeadFocus]
  if (cardKey) {
    try {
      localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${cardKey}`, "true")
    } catch {
      // ignore storage failures
    }
  }

  if (!shouldExpandRawForFocus(trimmed)) return

  try {
    localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}ava-cognitive-raw`, "true")
  } catch {
    // ignore
  }

  const domain = resolveCognitiveDomainFromFocus(trimmed)
  const persistKey = resolveAvaRawDomainPersistKey(domain)
  if (!persistKey) return
  try {
    localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${persistKey}`, "true")
  } catch {
    // ignore
  }
}

export function scrollGrowthCommandLeadFocusSection(focus: string | null | undefined): void {
  if (!focus || typeof document === "undefined") return
  const trimmed = String(focus).trim()
  if (!trimmed) return

  const sectionId = GROWTH_COMMAND_FOCUS_SECTION_IDS[trimmed as GrowthCommandLeadFocus]
  const targetId =
    sectionId ?? (trimmed === "command" ? GROWTH_AVA_COGNITIVE_SECTION_IDS.assessment : null)
  if (!targetId) return

  requestAnimationFrame(() => {
    if (shouldExpandRawForFocus(trimmed)) {
      document.getElementById(GROWTH_AVA_COGNITIVE_SECTION_IDS.raw_intelligence)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 160)
      return
    }
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
  })
}
