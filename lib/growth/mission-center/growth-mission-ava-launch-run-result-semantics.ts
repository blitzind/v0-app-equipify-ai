/** GE-AVA-LAUNCH-RESULT-SEMANTICS-1 / 1B — Run Ava success result semantics (client-safe). */

import type {
  GrowthMissionAvaLaunchRunLeadResearchStatus,
  GrowthMissionAvaLaunchRunHumanApprovalSummary,
} from "@/lib/growth/mission-center/growth-mission-ava-launch-run-api-contract"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { completedWorkTitle } from "@/lib/workspace/ai-teammate-voice"

export const GROWTH_AVA_LAUNCH_RESULT_SEMANTICS_1_QA_MARKER =
  "ge-ava-launch-result-semantics-1-v1" as const

export const GROWTH_AVA_LAUNCH_STOPPED_AT = [
  "human_approval",
  "research_pending",
  "import_complete",
] as const

export type GrowthMissionAvaLaunchRunStoppedAt = (typeof GROWTH_AVA_LAUNCH_STOPPED_AT)[number]

export type GrowthMissionAvaLaunchRunResultSemantics = {
  qa_marker: typeof GROWTH_AVA_LAUNCH_RESULT_SEMANTICS_1_QA_MARKER
  importedLeadCount: number
  runCreatedApprovalCount: number
  orgHumanApprovalPendingTotal: number
  researchPendingCount: number
  stoppedAt: GrowthMissionAvaLaunchRunStoppedAt
}

type PendingApprovalLike = {
  status: string
  subjectType?: string
  subjectId?: string
}

export function filterOrgHumanApprovalPendingItems<T extends PendingApprovalLike>(items: T[]): T[] {
  return items.filter(
    (item) => item.status === "pending" || item.status === "needs_review" || item.status === "blocked",
  )
}

export function countRunRelatedHumanApprovalPending(
  pendingItems: PendingApprovalLike[],
  importedLeadIds: readonly string[],
): number {
  if (importedLeadIds.length === 0) return 0
  const importedSet = new Set(importedLeadIds)
  return pendingItems.filter(
    (item) =>
      item.subjectType === "lead" &&
      typeof item.subjectId === "string" &&
      importedSet.has(item.subjectId),
  ).length
}

export function countAvaLaunchResearchPendingLeads(
  leads: readonly GrowthMissionAvaLaunchRunLeadResearchStatus[],
): number {
  return leads.filter((lead) => lead.workflowStatus !== "assessed").length
}

export function resolveAvaLaunchRunStoppedAt(input: {
  importedLeadCount: number
  runCreatedApprovalCount: number
}): GrowthMissionAvaLaunchRunStoppedAt {
  if (input.runCreatedApprovalCount > 0) return "human_approval"
  if (input.importedLeadCount > 0) return "research_pending"
  return "import_complete"
}

export function buildAvaLaunchRunResultSemantics(input: {
  importedLeadIds: readonly string[]
  researchLeads: readonly GrowthMissionAvaLaunchRunLeadResearchStatus[]
  orgPendingItems?: PendingApprovalLike[]
  orgHumanApprovalPendingTotal?: number
  runCreatedApprovalCount?: number
}): GrowthMissionAvaLaunchRunResultSemantics {
  const importedLeadCount = input.importedLeadIds.length
  const orgHumanApprovalPendingTotal =
    input.orgHumanApprovalPendingTotal ??
    (input.orgPendingItems ? input.orgPendingItems.length : 0)
  const runCreatedApprovalCount =
    input.runCreatedApprovalCount ??
    (input.orgPendingItems
      ? countRunRelatedHumanApprovalPending(input.orgPendingItems, input.importedLeadIds)
      : 0)
  const researchPendingCount =
    importedLeadCount > 0 ? countAvaLaunchResearchPendingLeads(input.researchLeads) : 0
  const stoppedAt = resolveAvaLaunchRunStoppedAt({
    importedLeadCount,
    runCreatedApprovalCount,
  })

  return {
    qa_marker: GROWTH_AVA_LAUNCH_RESULT_SEMANTICS_1_QA_MARKER,
    importedLeadCount,
    runCreatedApprovalCount,
    orgHumanApprovalPendingTotal,
    researchPendingCount,
    stoppedAt,
  }
}

export function buildAvaLaunchRunSuccessMessage(
  semantics: Pick<
    GrowthMissionAvaLaunchRunResultSemantics,
    | "importedLeadCount"
    | "runCreatedApprovalCount"
    | "orgHumanApprovalPendingTotal"
    | "researchPendingCount"
    | "stoppedAt"
  >,
  teammateName?: string | null,
): string {
  const teammate = resolveAiTeammatePresentation(teammateName)
  const lines: string[] = []

  if (semantics.importedLeadCount === 0) {
    lines.push("Import complete. No new leads were imported from this run.")
  } else {
    lines.push(
      `Imported ${semantics.importedLeadCount} lead${semantics.importedLeadCount === 1 ? "" : "s"}.`,
    )
  }

  if (semantics.stoppedAt === "research_pending") {
    lines.push("Research is running asynchronously.")
    lines.push("Completed work will appear after research and outreach preparation.")
  } else if (semantics.stoppedAt === "human_approval") {
    lines.push(
      `${semantics.runCreatedApprovalCount} completed task${semantics.runCreatedApprovalCount === 1 ? "" : "s"} from this run ${semantics.runCreatedApprovalCount === 1 ? "is" : "are"} ready in ${completedWorkTitle(teammate).toLowerCase()}.`,
    )
  } else if (semantics.importedLeadCount === 0) {
    lines.push("Completed work will appear after research and outreach preparation when leads are imported.")
  }

  if (semantics.orgHumanApprovalPendingTotal > 0) {
    lines.push(
      `Your organization has ${semantics.orgHumanApprovalPendingTotal} existing completed task${semantics.orgHumanApprovalPendingTotal === 1 ? "" : "s"} waiting for authorization (not created by this run).`,
    )
  }

  return lines.join(" ")
}

export function buildAvaLaunchRunHumanApprovalSummary(input: {
  orgPendingItems: PendingApprovalLike[]
  importedLeadIds: readonly string[]
  topItems: GrowthMissionAvaLaunchRunHumanApprovalSummary["topItems"]
}): GrowthMissionAvaLaunchRunHumanApprovalSummary {
  const runRelatedPending = countRunRelatedHumanApprovalPending(
    input.orgPendingItems,
    input.importedLeadIds,
  )

  return {
    orgHumanApprovalPendingTotal: input.orgPendingItems.length,
    runRelatedPending,
    topItems: input.topItems,
    approvalsHref: "/growth/os/approvals",
  }
}
