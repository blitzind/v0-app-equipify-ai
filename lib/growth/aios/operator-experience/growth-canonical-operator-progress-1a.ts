/**
 * GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A — Progress projection (client-safe).
 * Reframes Work Manager + daily queue as "everything else" — not a separate planner.
 */

import { GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import type {
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

export type GrowthCanonicalOperatorProgressItem = {
  id: string
  label: string
  detail: string | null
  href: string | null
  kind: "working" | "queued" | "completed" | "background"
}

export type GrowthCanonicalOperatorProgressProjection = {
  qaMarker: typeof GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER
  title: string
  subtitle: string
  items: GrowthCanonicalOperatorProgressItem[]
  activeLabel: string | null
}

export function projectCanonicalOperatorProgress(input: {
  workManager?: AvaWorkManagerResult | null
  dailyWorkQueue?: GrowthHomeDailyWorkQueueItem[]
  waitingOnYou?: GrowthHomeWaitingOnYouItem[]
  focusLeadId?: string | null
}): GrowthCanonicalOperatorProgressProjection {
  const waitingIds = new Set((input.waitingOnYou ?? []).map((row) => row.id))
  const items: GrowthCanonicalOperatorProgressItem[] = []

  const wm = input.workManager
  if (wm?.active_work) {
    items.push({
      id: wm.active_work.id,
      label: wm.active_work.company_name ?? wm.active_work.title,
      detail: wm.active_work.why_it_matters ?? null,
      href: wm.active_work.href ?? null,
      kind: "working",
    })
  }

  for (const entry of wm?.work_plan ?? []) {
    if (entry.status !== "ready") continue
    const workItem = wm?.all_work_items.find((row) => row.id === entry.work_item_id)
    if (!workItem || workItem.id === wm?.active_work?.id) continue
    items.push({
      id: workItem.id,
      label: workItem.company_name ?? workItem.title,
      detail: workItem.why_it_matters ?? null,
      href: workItem.href ?? null,
      kind: "queued",
    })
    if (items.length >= 6) break
  }

  for (const row of input.dailyWorkQueue ?? []) {
    if (waitingIds.has(row.id)) continue
    if (input.focusLeadId && row.leadId === input.focusLeadId) continue
    items.push({
      id: row.id,
      label: row.companyName ?? row.label,
      detail: row.detail ?? null,
      href: row.href ?? null,
      kind: "background",
    })
    if (items.length >= 8) break
  }

  const activeLabel = wm?.active_work
    ? wm.active_work.company_name ?? wm.active_work.title
    : items[0]?.label ?? null

  return {
    qaMarker: GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
    title: "Progress",
    subtitle: "Background work and momentum across your accounts",
    items,
    activeLabel,
  }
}
