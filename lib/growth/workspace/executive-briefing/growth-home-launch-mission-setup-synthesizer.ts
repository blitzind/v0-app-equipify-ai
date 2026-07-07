/** GE-AVA-LAUNCH-MISSION-SETUP-1A — Start Ava setup read model (client-safe, no side effects). */

import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import { GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { selectDefaultFindLeadsMissionId } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-display"
import {
  GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER,
  GROWTH_AVA_LAUNCH_MISSION_SETUP_COMPLETE_COPY,
  GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS,
  GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE,
  GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE,
} from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-1a"

export type GrowthHomeLaunchMissionSetupStepId = keyof typeof GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS

export type GrowthHomeLaunchMissionSetupStepStatus =
  | "complete"
  | "pending"
  | "blocked"
  | "warning"

export type GrowthHomeLaunchMissionSetupActionKind =
  | "scroll_profile"
  | "create_mission"
  | "scroll_find_leads"
  | "scroll_mailbox"
  | "none"

export type GrowthHomeLaunchMissionSetupStep = {
  id: GrowthHomeLaunchMissionSetupStepId
  label: string
  status: GrowthHomeLaunchMissionSetupStepStatus
  summary: string
  blocksLaunch: boolean
  actionKind: GrowthHomeLaunchMissionSetupActionKind
}

export type GrowthHomeLaunchMissionSetupViewModel = {
  qaMarker: typeof GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER
  readOnly: true
  showCard: boolean
  setupComplete: boolean
  readyForMonitoring: boolean
  completionCopy: string | null
  currentStepId: GrowthHomeLaunchMissionSetupStepId | null
  acquisitionMissionId: string | null
  steps: GrowthHomeLaunchMissionSetupStep[]
}

export type GrowthHomeLaunchMissionSetupInput = {
  businessProfileApproved: boolean
  hasBusinessProfileDraft: boolean
  objectives: GrowthObjective[]
  mailboxWarnings: number
  expiredMailboxes: number
  mailboxSummary?: string | null
}

export function selectActiveAcquisitionObjectives(objectives: GrowthObjective[]): GrowthObjective[] {
  return objectives.filter(
    (entry) =>
      (entry.status === "active" || entry.status === "planning" || entry.runtime?.running) &&
      (entry.objectiveType === GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE ||
        entry.objectiveType === "opportunities_created" ||
        entry.objectiveType === "pipeline_value" ||
        entry.objectiveType === "demos_booked" ||
        entry.objectiveType === "meetings_booked"),
  )
}

export function resolveAcquisitionMission(objectives: GrowthObjective[]): GrowthObjective | null {
  const active = selectActiveAcquisitionObjectives(objectives)
  const preferredId = selectDefaultFindLeadsMissionId(
    active.map((entry) => ({
      id: entry.id,
      title: entry.title,
      status: entry.status,
      objectiveType: entry.objectiveType,
      runtime: entry.runtime,
    })),
  )
  if (preferredId) {
    return active.find((entry) => entry.id === preferredId) ?? active[0] ?? null
  }
  return active[0] ?? null
}

export function hasLeadSearchBound(objective: GrowthObjective | null | undefined): boolean {
  if (!objective) return false
  const runtime = objective.executionContext?.missionRuntime
  if (runtime?.qa_marker !== GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER) return false
  return Boolean(runtime.datamoon?.importRequestJson?.trim())
}

export function isLaunchMissionSetupComplete(input: GrowthHomeLaunchMissionSetupInput): boolean {
  const view = synthesizeGrowthHomeLaunchMissionSetup(input)
  return view.setupComplete
}

export function shouldShowStartAvaSetupCard(input: GrowthHomeLaunchMissionSetupInput): boolean {
  const view = synthesizeGrowthHomeLaunchMissionSetup(input)
  return view.showCard
}

export function synthesizeGrowthHomeLaunchMissionSetup(
  input: GrowthHomeLaunchMissionSetupInput,
): GrowthHomeLaunchMissionSetupViewModel {
  const acquisitionMission = resolveAcquisitionMission(input.objectives)
  const hasMission = Boolean(acquisitionMission)
  const leadSearchBound = hasLeadSearchBound(acquisitionMission)
  const mailboxBlocksLaunch = input.expiredMailboxes > 0
  const mailboxHasWarnings = input.mailboxWarnings > 0 || input.expiredMailboxes > 0

  const growthProfileStep: GrowthHomeLaunchMissionSetupStep = input.businessProfileApproved
    ? {
        id: "growth_profile",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.growth_profile,
        status: "complete",
        summary: "Growth Profile approved.",
        blocksLaunch: false,
        actionKind: "none",
      }
    : {
        id: "growth_profile",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.growth_profile,
        status: input.hasBusinessProfileDraft ? "pending" : "blocked",
        summary: input.hasBusinessProfileDraft
          ? "Review and approve your Growth Profile."
          : "Create and approve your Growth Profile.",
        blocksLaunch: true,
        actionKind: "scroll_profile",
      }

  const missionStep: GrowthHomeLaunchMissionSetupStep = hasMission
    ? {
        id: "mission",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.mission,
        status: "complete",
        summary: acquisitionMission?.title ?? GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE,
        blocksLaunch: false,
        actionKind: "none",
      }
    : {
        id: "mission",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.mission,
        status: input.businessProfileApproved ? "pending" : "blocked",
        summary: input.businessProfileApproved
          ? `Create the "${GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE}" mission.`
          : "Approve Growth Profile before creating a mission.",
        blocksLaunch: true,
        actionKind: input.businessProfileApproved ? "create_mission" : "scroll_profile",
      }

  const leadSearchStep: GrowthHomeLaunchMissionSetupStep = leadSearchBound
    ? {
        id: "lead_search",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.lead_search,
        status: "complete",
        summary: "Find Leads search is bound to your mission.",
        blocksLaunch: false,
        actionKind: "none",
      }
    : {
        id: "lead_search",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.lead_search,
        status: hasMission && input.businessProfileApproved ? "pending" : "blocked",
        summary: hasMission
          ? "Bind a Find Leads search to your mission."
          : "Create a mission before binding lead search.",
        blocksLaunch: true,
        actionKind: hasMission && input.businessProfileApproved ? "scroll_find_leads" : "none",
      }

  const mailboxStep: GrowthHomeLaunchMissionSetupStep = mailboxBlocksLaunch
    ? {
        id: "mailbox_readiness",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.mailbox_readiness,
        status: "blocked",
        summary:
          input.mailboxSummary?.trim() ||
          `${input.expiredMailboxes} mailbox connection(s) need reconnection before launch.`,
        blocksLaunch: true,
        actionKind: "scroll_mailbox",
      }
    : mailboxHasWarnings
      ? {
          id: "mailbox_readiness",
          label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.mailbox_readiness,
          status: "warning",
          summary:
            input.mailboxSummary?.trim() ||
            `${input.mailboxWarnings} mailbox warning(s) — review before outbound, but setup can continue.`,
          blocksLaunch: false,
          actionKind: "scroll_mailbox",
        }
      : {
          id: "mailbox_readiness",
          label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.mailbox_readiness,
          status: "complete",
          summary: "Mailboxes look ready.",
          blocksLaunch: false,
          actionKind: "none",
        }

  const approvalStep: GrowthHomeLaunchMissionSetupStep = {
    id: "approval_guardrails",
    label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.approval_guardrails,
    status: "complete",
    summary: "Human approval is required before Ava sends outbound.",
    blocksLaunch: false,
    actionKind: "none",
  }

  const steps = [growthProfileStep, missionStep, leadSearchStep, mailboxStep, approvalStep]
  const blockingSteps = steps.filter((step) => step.blocksLaunch && step.status !== "complete")
  const setupComplete =
    input.businessProfileApproved &&
    hasMission &&
    leadSearchBound &&
    !mailboxBlocksLaunch
  const readyForMonitoring = setupComplete
  const currentStepId =
    blockingSteps[0]?.id ??
    steps.find((step) => step.status === "pending" || step.status === "warning")?.id ??
    null

  const hasRealActiveMission = selectActiveAcquisitionObjectives(input.objectives).length > 0
  const showCard = !hasRealActiveMission || !setupComplete

  return {
    qaMarker: GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER,
    readOnly: true,
    showCard,
    setupComplete,
    readyForMonitoring,
    completionCopy: readyForMonitoring ? GROWTH_AVA_LAUNCH_MISSION_SETUP_COMPLETE_COPY : null,
    currentStepId,
    acquisitionMissionId: acquisitionMission?.id ?? null,
    steps,
  }
}
