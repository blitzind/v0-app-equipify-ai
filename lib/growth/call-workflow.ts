import {
  GROWTH_DRAWER_CARD_KEYS,
  GROWTH_DRAWER_CARD_PERSIST_PREFIX,
} from "@/lib/growth/growth-lead-drawer-stream-filters"

export const GROWTH_REALTIME_CALL_SECTION_ID = "growth-realtime-call"
export const GROWTH_CALL_COPILOT_SECTION_ID = "growth-call-copilot"

export function expandGrowthDrawerCallIntelligencePanels(): void {
  if (typeof window === "undefined") return
  for (const key of [GROWTH_DRAWER_CARD_KEYS.callCopilot, GROWTH_DRAWER_CARD_KEYS.realtimeCall]) {
    try {
      localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${key}`, "true")
    } catch {
      // ignore storage failures
    }
  }
}

export function scrollGrowthDrawerRealtimeCallIntelligence(): void {
  if (typeof document === "undefined") return
  requestAnimationFrame(() => {
    document.getElementById(GROWTH_REALTIME_CALL_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" })
  })
}

export function formatGrowthCallDialerNextStep(dialerLabel: string): string {
  return `Call opened in ${dialerLabel}. Start Realtime Coaching when the call begins.`
}
