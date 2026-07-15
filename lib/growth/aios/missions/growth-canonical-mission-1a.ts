/**
 * GE-AIOS-MISSION-ORCHESTRATION-1A — Canonical account mission projection (client-safe).
 * Mission owns nothing — assembles existing certified subsystems only.
 */

import type { GrowthHumanApprovalItem } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthCanonicalPrimaryAction } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import { projectGrowthCanonicalOperatorDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import {
  humanizeOperatorDecisionTitle,
  humanizeOperatorFacingLine,
} from "@/lib/growth/aios/operator-experience/growth-operator-language-1a"
import { projectCanonicalLeadOpportunityNarrative } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  buildMissionProgressStages,
  buildMissionTitle,
  formatMissionPhaseLabel,
  resolveMissionPhaseFromPrimaryAction,
  resolveMissionTypeFromPrimaryAction,
} from "@/lib/growth/aios/missions/growth-canonical-mission-1a-phases"
import {
  GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER,
  type BuildCanonicalMissionInput,
  type GrowthCanonicalActiveMissionsProjection,
  type GrowthCanonicalMission,
  type GrowthCanonicalMissionApprovalItem,
  type GrowthCanonicalMissionTimelineEvent,
} from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import { GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"

export function resolveCanonicalMissionId(leadId: string): string {
  return `mission:${leadId}`
}

function primaryActionFromInput(
  input: BuildCanonicalMissionInput,
): GrowthCanonicalPrimaryAction | null {
  const raw = input.decisionResolution?.decision.primaryAction
  return raw ?? null
}

function resolveMissionApprovals(input: BuildCanonicalMissionInput): GrowthCanonicalMissionApprovalItem[] {
  const items = input.hacItems ?? []
  const leadItems = items.filter(
    (row) => row.subjectType === "lead" && row.subjectId === input.leadId,
  )

  return leadItems.map((item) => ({
    itemId: item.id,
    label: humanizeOperatorFacingLine(item.title || item.summary || "Approval required"),
    status:
      item.status === "approved" || item.status === "approved_elsewhere"
        ? "approved"
        : item.status === "completed"
          ? "complete"
          : "waiting",
    href: item.route ?? null,
  }))
}

function buildTimelineSummary(events: GrowthCanonicalMissionTimelineEvent[] | undefined): string | null {
  if (!events?.length) return null
  const latest = [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0]
  return latest ? humanizeOperatorFacingLine(latest.summary) : null
}

export function buildCanonicalMission(input: BuildCanonicalMissionInput): GrowthCanonicalMission {
  const primaryAction = primaryActionFromInput(input)
  const missionType = resolveMissionTypeFromPrimaryAction(primaryAction)
  const missionPhase = resolveMissionPhaseFromPrimaryAction(primaryAction)
  const missionTitle = buildMissionTitle(input.companyName, missionType)

  const decisionProjection = input.decisionResolution
    ? projectGrowthCanonicalOperatorDecision({
        decision: input.decisionResolution.decision,
        freshness: input.decisionResolution.freshness,
      })
    : null

  const opportunityNarrative =
    input.opportunityNarrative ??
    projectCanonicalLeadOpportunityNarrative({
      leadId: input.leadId,
      companyName: input.companyName,
      decision: decisionProjection,
      approvalSnapshot: input.approvalSnapshot,
      hacItem: input.hacItems?.find(
        (row) => row.subjectType === "lead" && row.subjectId === input.leadId,
      ),
    })

  const packageForLead =
    input.packagePreview ??
    input.approvalSnapshot?.packages.find((row) => row.leadId === input.leadId) ??
    null

  const requiredApprovals = resolveMissionApprovals(input)
  const approvalBlocker =
    requiredApprovals.find((row) => row.status === "waiting")?.label ??
    opportunityNarrative.blockedBy

  const nextAvaAction = decisionProjection
    ? humanizeOperatorDecisionTitle(decisionProjection.whatToDo, decisionProjection.primaryAction)
    : opportunityNarrative.nextStep

  const nextOperatorAction =
    input.operatorTask?.title ??
    (approvalBlocker ? humanizeOperatorFacingLine(approvalBlocker) : null)

  const expectedOutcome =
    input.operatorTask?.whatHappensNext ??
    decisionProjection?.thenActions[0] ??
    opportunityNarrative.progress

  const supportingEvidence = [
    ...opportunityNarrative.evidence,
    ...(decisionProjection?.why ?? []).slice(0, 2),
  ].filter((row, index, all) => Boolean(row?.trim()) && all.indexOf(row) === index)

  const workspaceHref = `${GROWTH_WORKSPACE_BASE_PATH}/leads/${input.leadId}`
  const approvalsHref = `${GROWTH_WORKSPACE_BASE_PATH}/os/approvals`
  const completedWorkHref = approvalsHref
  const callWorkspaceHref = `${GROWTH_WORKSPACE_BASE_PATH}/calls?leadId=${input.leadId}`
  const meetingHref = input.upcomingMeeting?.at ? `${GROWTH_WORKSPACE_BASE_PATH}/meetings` : null

  return {
    qaMarker: GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER,
    missionId: resolveCanonicalMissionId(input.leadId),
    leadId: input.leadId,
    organizationId: input.organizationId,
    companyName: input.companyName,
    contactName: input.contactName?.trim() || null,
    missionType,
    missionTitle,
    missionObjective: opportunityNarrative.currentFocus,
    missionPhase,
    currentOwner: "ava",
    humanOwner: input.humanOwnerName?.trim() || null,
    currentObjective: opportunityNarrative.currentFocus,
    currentBlocker: approvalBlocker,
    nextAvaAction,
    nextOperatorAction,
    expectedOutcome: expectedOutcome ? humanizeOperatorFacingLine(expectedOutcome) : null,
    supportingEvidence,
    riskSummary: decisionProjection?.doNotActions[0]
      ? humanizeOperatorFacingLine(decisionProjection.doNotActions[0])
      : null,
    confidenceSummary: decisionProjection?.confidenceLabel ?? null,
    timelineSummary: buildTimelineSummary(input.timelineEvents),
    requiredApprovals,
    upcomingMeeting: input.upcomingMeeting ?? null,
    openCommitments: input.openCommitments ?? [],
    currentPackage: packageForLead,
    currentConversation: input.conversationSummary?.trim() || null,
    relationshipSummary: input.relationshipSummary?.trim() || null,
    progress: buildMissionProgressStages(missionPhase),
    activePhaseLabel: formatMissionPhaseLabel(missionPhase),
    priorityScore: input.priorityScore ?? packageForLead?.draftCount ?? 0,
    decisionFingerprint: decisionProjection?.decisionFingerprint ?? null,
    primaryAction,
    workspaceHref,
    completedWorkHref,
    approvalsHref,
    callWorkspaceHref,
    meetingHref,
  }
}

export function buildCanonicalActiveMissionsProjection(input: {
  organizationId: string
  missions: GrowthCanonicalMission[]
  displayLimit?: number
}): GrowthCanonicalActiveMissionsProjection {
  const byLead = new Map<string, GrowthCanonicalMission>()
  for (const mission of input.missions) {
    if (!byLead.has(mission.leadId)) {
      byLead.set(mission.leadId, mission)
    }
  }

  const sorted = [...byLead.values()].sort((a, b) => b.priorityScore - a.priorityScore)
  const displayLimit = input.displayLimit ?? GROWTH_HOME_CANONICAL_MISSIONS_DISPLAY_LIMIT
  const missions = sorted.slice(0, displayLimit)

  return {
    qaMarker: GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER,
    missions,
    primaryMission: missions[0] ?? null,
    totalMissionCount: sorted.length,
    overflowMissionCount: Math.max(0, sorted.length - missions.length),
    displayLimit,
  }
}

export function buildCanonicalMissionsFromApprovalSnapshot(input: {
  organizationId: string
  approvalSnapshot: import("@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types").GrowthCanonicalOperatorApprovalSnapshot
  decisionByLeadId?: Map<string, BuildCanonicalMissionInput["decisionResolution"]>
  operatorTaskByLeadId?: Map<string, BuildCanonicalMissionInput["operatorTask"]>
  hacItems?: GrowthHumanApprovalItem[]
}): GrowthCanonicalMission[] {
  const seen = new Set<string>()
  const missions: GrowthCanonicalMission[] = []

  for (const pkg of input.approvalSnapshot.packages) {
    if (!pkg.leadId || seen.has(pkg.leadId)) continue
    seen.add(pkg.leadId)
    missions.push(
      buildCanonicalMission({
        organizationId: input.organizationId,
        leadId: pkg.leadId,
        companyName: pkg.companyName,
        approvalSnapshot: input.approvalSnapshot,
        packagePreview: pkg,
        decisionResolution: input.decisionByLeadId?.get(pkg.leadId),
        operatorTask: input.operatorTaskByLeadId?.get(pkg.leadId),
        hacItems: input.hacItems,
        priorityScore: pkg.draftCount,
      }),
    )
  }

  return missions
}

export function projectMissionApprovalQueueLabel(mission: GrowthCanonicalMission): string {
  const waiting = mission.requiredApprovals.filter((row) => row.status === "waiting")
  if (waiting.length === 0) return mission.missionTitle
  if (waiting.length === 1) return `${mission.missionTitle} — ${waiting[0]!.label}`
  return `${mission.missionTitle} — ${waiting.length} approvals waiting`
}

export type GrowthCanonicalCompletedWorkMissionGroup = {
  missionId: string
  missionTitle: string
  companyName: string
  leadId: string
  completed: string[]
  waiting: string[]
  href: string
}

export function groupCompletedWorkByMission(input: {
  items: GrowthHumanApprovalItem[]
  missionsByLeadId: Map<string, GrowthCanonicalMission>
}): GrowthCanonicalCompletedWorkMissionGroup[] {
  const groups = new Map<string, GrowthCanonicalCompletedWorkMissionGroup>()

  for (const item of input.items) {
    const leadId = item.subjectType === "lead" ? item.subjectId : null
    if (!leadId) continue

    const mission = input.missionsByLeadId.get(leadId)
    const companyName =
      mission?.companyName ??
      item.title.split("—").pop()?.trim() ??
      item.summary ??
      "Account"
    const missionTitle = mission?.missionTitle ?? `Acquire ${companyName}`
    const missionId = mission?.missionId ?? resolveCanonicalMissionId(leadId)

    const group =
      groups.get(leadId) ??
      ({
        missionId,
        missionTitle,
        companyName,
        leadId,
        completed: [],
        waiting: [],
        href: mission?.workspaceHref ?? `${GROWTH_WORKSPACE_BASE_PATH}/leads/${leadId}`,
      } satisfies GrowthCanonicalCompletedWorkMissionGroup)

    const label = humanizeOperatorFacingLine(item.title || item.summary || "Work item")
    if (item.status === "approved" || item.status === "approved_elsewhere" || item.status === "completed") {
      group.completed.push(label)
    } else {
      group.waiting.push(label)
    }

    groups.set(leadId, group)
  }

  return [...groups.values()]
}

export function buildCanonicalMissionTimelineFromSources(input: {
  decisionGeneratedAt?: string | null
  packagePreparedAt?: string | null
  approvalItems?: GrowthHumanApprovalItem[]
  meetingAt?: string | null
  meetingSummary?: string | null
}): GrowthCanonicalMissionTimelineEvent[] {
  const events: GrowthCanonicalMissionTimelineEvent[] = []

  if (input.decisionGeneratedAt) {
    events.push({
      id: "decision",
      occurredAt: input.decisionGeneratedAt,
      category: "decision",
      summary: "Decision updated",
    })
  }

  if (input.packagePreparedAt) {
    events.push({
      id: "package",
      occurredAt: input.packagePreparedAt,
      category: "package",
      summary: "Outreach package prepared",
    })
  }

  for (const item of input.approvalItems ?? []) {
    events.push({
      id: `approval:${item.id}`,
      occurredAt: item.createdAt,
      category: "approval",
      summary: item.title || item.summary || "Approval event",
      href: item.route ?? null,
    })
  }

  if (input.meetingAt) {
    events.push({
      id: "meeting",
      occurredAt: input.meetingAt,
      category: "meeting",
      summary: input.meetingSummary ?? "Upcoming meeting",
    })
  }

  return events.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
}
