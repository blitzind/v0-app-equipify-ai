/**
 * GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A — One canonical operator focus (client-safe).
 * Priority: approvals → mission blocker → canonical decision → revenue queue navigation.
 */

import { resolveAuthoritativeForm } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"
import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalMission } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  humanizeOperatorDecisionTitle,
  humanizeOperatorFacingLine,
} from "@/lib/growth/aios/operator-experience/growth-operator-language-1a"
import type { GrowthCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"
import {
  GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
  type GrowthCanonicalOperatorFocus,
  type GrowthCanonicalOperatorFocusSource,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"

export {
  GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"
export type {
  GrowthCanonicalOperatorFocus,
  GrowthCanonicalOperatorFocusSource,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-focus-1a-types"

const SOURCE_PRIORITY: Record<GrowthCanonicalOperatorFocusSource, number> = {
  approval: 1,
  mission_blocker: 2,
  decision: 3,
  revenue_queue: 4,
}

function leadWorkspaceHref(leadId: string): string {
  return `${GROWTH_WORKSPACE_BASE_PATH}/leads/${leadId}`
}

function resolveCompanyName(
  leadId: string,
  fallback: string | null | undefined,
  leadsById: Map<string, string>,
): string {
  const fromPool = leadsById.get(leadId)
  if (fromPool) return resolveAuthoritativeForm(fromPool)
  return resolveAuthoritativeForm(fallback ?? "Account")
}

export function buildCanonicalOperatorFocus(input: {
  approvalSnapshot?: GrowthCanonicalOperatorApprovalSnapshot | null
  missions?: GrowthCanonicalMission[]
  decisionResolution?: GrowthCanonicalDecisionResolution | null
  revenueQueueLeadId?: string | null
  revenueQueueCompanyName?: string | null
  leads?: Array<{ id: string; companyName: string }>
}): GrowthCanonicalOperatorFocus | null {
  const leadsById = new Map(
    (input.leads ?? []).map((row) => [row.id, row.companyName]),
  )

  const approvalLeadId = input.approvalSnapshot?.topPackage?.leadId?.trim() || null
  if (approvalLeadId) {
    const top = input.approvalSnapshot!.topPackage!
    return {
      qaMarker: GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
      leadId: approvalLeadId,
      companyName: resolveAuthoritativeForm(top.companyName),
      source: "approval",
      title: `Review ${resolveAuthoritativeForm(top.companyName)}`,
      detail: top.channelLabel
        ? `${top.channelLabel} prepared for your review`
        : "Outreach prepared for your review",
      href: top.reviewHref || leadWorkspaceHref(approvalLeadId),
      priorityRank: SOURCE_PRIORITY.approval,
    }
  }

  const blockedMission = (input.missions ?? []).find((row) => row.currentBlocker?.trim())
  if (blockedMission) {
    return {
      qaMarker: GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
      leadId: blockedMission.leadId,
      companyName: resolveAuthoritativeForm(blockedMission.companyName),
      source: "mission_blocker",
      title: blockedMission.missionTitle,
      detail: humanizeOperatorFacingLine(blockedMission.currentBlocker),
      href: blockedMission.workspaceHref,
      priorityRank: SOURCE_PRIORITY.mission_blocker,
    }
  }

  const decisionLeadId = input.decisionResolution?.leadId?.trim() || null
  if (decisionLeadId && input.decisionResolution) {
    const decision = input.decisionResolution.decision
    return {
      qaMarker: GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
      leadId: decisionLeadId,
      companyName: resolveCompanyName(
        decisionLeadId,
        input.decisionResolution.companyName,
        leadsById,
      ),
      source: "decision",
      title: humanizeOperatorDecisionTitle(decision.title, decision.primaryAction),
      detail: decision.supportingActions[0]?.label
        ? humanizeOperatorFacingLine(decision.supportingActions[0].label)
        : null,
      href: leadWorkspaceHref(decisionLeadId),
      priorityRank: SOURCE_PRIORITY.decision,
    }
  }

  const queueLeadId = input.revenueQueueLeadId?.trim() || null
  if (queueLeadId) {
    return {
      qaMarker: GROWTH_AIOS_OPERATOR_STORY_IMPLEMENTATION_1A_QA_MARKER,
      leadId: queueLeadId,
      companyName: resolveCompanyName(queueLeadId, input.revenueQueueCompanyName, leadsById),
      source: "revenue_queue",
      title: `Open ${resolveCompanyName(queueLeadId, input.revenueQueueCompanyName, leadsById)}`,
      detail: "Pick up where we left off on this account",
      href: leadWorkspaceHref(queueLeadId),
      priorityRank: SOURCE_PRIORITY.revenue_queue,
    }
  }

  return null
}

export function assertCanonicalOperatorFocusAlignment(input: {
  focus: GrowthCanonicalOperatorFocus | null
  operatorTaskLeadId?: string | null
  heroDecisionLeadId?: string | null
}): boolean {
  if (!input.focus) return true
  const focusId = input.focus.leadId
  if (input.heroDecisionLeadId && input.heroDecisionLeadId !== focusId) return false
  if (input.operatorTaskLeadId && input.operatorTaskLeadId !== focusId) {
    // Approval tasks always align; decision-only tasks may omit leadId historically.
    return input.focus.source === "approval"
  }
  return true
}
