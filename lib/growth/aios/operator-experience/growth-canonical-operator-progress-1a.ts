/**
 * GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A — Progress projection (client-safe).
 * Reframes Work Manager + daily queue as "everything else" — not a separate planner.
 */

import { GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
import {
  resolveRuntimeExecutionActiveLabel,
  resolveRuntimeExecutionPresentation,
} from "@/lib/growth/home/growth-home-runtime-execution-presentation-1b"
import type { GrowthAiosAutonomyTickHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"
import type { GrowthProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { buildMissionDiscoveryOperatorProgressItems } from "@/lib/growth/mission-center/growth-autonomous-lead-discovery-18g"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import { GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a-types"
import type {
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import type { GrowthHomeCanonicalRuntimeActivityPayload } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"

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
  eligibleLeadCount?: number | null
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  portfolioTargetCurrent?: number | null
  portfolioTargetGoal?: number | null
  pendingApprovals?: number
  operatorApprovalCompanyName?: string | null
  activeClaim?: GrowthHomeCanonicalRuntimeActivityPayload["activeClaim"] | null
  portfolioOperator?: GrowthPortfolioManagerOperatorProjection | null
  productionMissionAuthority?: GrowthProductionMissionAuthority | null
  autonomyTickHealth?: GrowthAiosAutonomyTickHealthSnapshot | null
}): GrowthCanonicalOperatorProgressProjection {
  const waitingIds = new Set((input.waitingOnYou ?? []).map((row) => row.id))
  const items: GrowthCanonicalOperatorProgressItem[] = []

  const wm = input.workManager
  if (wm?.active_work) {
    items.push({
      id: wm.active_work.id,
      label: wm.active_work.company_name ?? wm.active_work.title,
      detail: wm.active_work.description ?? null,
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
      detail: workItem.description ?? null,
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

  const missionProgressItems = buildMissionDiscoveryOperatorProgressItems(input.missionDiscovery, {
    portfolioTargetCurrent: input.portfolioTargetCurrent,
    portfolioTargetGoal: input.portfolioTargetGoal,
  })
  if (items.length === 0) {
    items.push(...missionProgressItems)
  }

  const missionActiveLabel = missionProgressItems[0]?.label ?? null
  const runtimeExecutionInput = {
    pendingApprovals: input.pendingApprovals ?? 0,
    operatorApprovalCompanyName: input.operatorApprovalCompanyName ?? null,
    activeClaim: input.activeClaim ?? null,
    activeWork: wm?.active_work ?? null,
    portfolioOperator: input.portfolioOperator ?? null,
    missionDiscovery: input.missionDiscovery ?? null,
    productionMissionAuthority: input.productionMissionAuthority ?? null,
    autonomyTickHealth: input.autonomyTickHealth ?? null,
  }
  const runtimePresentation = resolveRuntimeExecutionPresentation(runtimeExecutionInput)
  const activeLabel =
    resolveRuntimeExecutionActiveLabel(runtimeExecutionInput) ??
    missionActiveLabel ??
    items[0]?.label ??
    (input.eligibleLeadCount === 0 ? GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY : null)

  const missionSubtitle = missionProgressItems[1]?.label ?? null

  return {
    qaMarker: GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
    title: "Progress",
    subtitle:
      runtimePresentation.currentActivityScope === "portfolio"
        ? runtimePresentation.currentActivityLabel ?? missionSubtitle ?? "Portfolio execution in progress"
        : missionSubtitle ??
          (input.eligibleLeadCount === 0 && !wm?.active_work && !missionActiveLabel
            ? GROWTH_PORTFOLIO_READY_NO_ELIGIBLE_ACCOUNTS_COPY
            : "Background work and momentum across your accounts"),
    items,
    activeLabel,
  }
}
