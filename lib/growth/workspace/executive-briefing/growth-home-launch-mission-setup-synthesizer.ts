/** GE-AVA-LAUNCH-MISSION-SETUP-1A / GE-AIOS-18D — Get Ava Ready setup read model (client-safe). */

import { areStartupAutonomyGuardrailsConfigured, computeStartupProgressPercent } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
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
  | "open_ai_teammate"
  | "open_autonomy_settings"
  | "open_mailbox_wizard"
  | "open_calendar_settings"
  | "open_booking_settings"
  | "none"

export type GrowthHomeLaunchMissionSetupStep = {
  id: GrowthHomeLaunchMissionSetupStepId
  label: string
  status: GrowthHomeLaunchMissionSetupStepStatus
  summary: string
  blocksLaunch: boolean
  actionKind: GrowthHomeLaunchMissionSetupActionKind
  href?: string | null
}

export type GrowthHomeLaunchMissionSetupViewModel = {
  qaMarker: typeof GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER
  readOnly: true
  showCard: boolean
  setupComplete: boolean
  readyForLaunch: boolean
  readyForMonitoring: boolean
  completionCopy: string | null
  currentStepId: GrowthHomeLaunchMissionSetupStepId | null
  acquisitionMissionId: string | null
  steps: GrowthHomeLaunchMissionSetupStep[]
  progressPercent: number
  completedStepCount: number
  totalStepCount: number
}

export type GrowthHomeLaunchMissionSetupInput = {
  businessProfileApproved: boolean
  hasBusinessProfileDraft: boolean
  objectives: GrowthObjective[]
  mailboxWarnings: number
  expiredMailboxes: number
  mailboxSummary?: string | null
  connectedMailboxes?: number
  aiTeammateOnboardingCompleted?: boolean
  autonomyGuardrailsConfigured?: boolean
  calendarConnected?: boolean
  bookingPagesCount?: number
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
  const hasConnectedMailbox = (input.connectedMailboxes ?? 0) > 0
  const autonomyConfigured =
    input.autonomyGuardrailsConfigured ??
    areStartupAutonomyGuardrailsConfigured({ approvalPolicies: {} })
  const calendarReady =
    input.calendarConnected === true || (input.bookingPagesCount ?? 0) > 0

  const meetAvaStep: GrowthHomeLaunchMissionSetupStep = input.aiTeammateOnboardingCompleted
    ? {
        id: "meet_ava",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.meet_ava,
        status: "complete",
        summary: "We've met — I know who I'm working for.",
        blocksLaunch: false,
        actionKind: "none",
      }
    : {
        id: "meet_ava",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.meet_ava,
        status: "pending",
        summary: "I need to meet you and learn how you'd like me to introduce myself.",
        blocksLaunch: true,
        actionKind: "open_ai_teammate",
        href: "/growth/settings/ai-teammate",
      }

  const growthProfileStep: GrowthHomeLaunchMissionSetupStep = input.businessProfileApproved
    ? {
        id: "growth_profile",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.growth_profile,
        status: "complete",
        summary: "I know your ideal customer profile, products, and competitors.",
        blocksLaunch: false,
        actionKind: "none",
      }
    : {
        id: "growth_profile",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.growth_profile,
        status: input.hasBusinessProfileDraft ? "pending" : "blocked",
        summary: input.hasBusinessProfileDraft
          ? "I need you to approve your Growth Profile before I can research the right companies."
          : "I need your Growth Profile and ideal customer profile before I can find companies to research.",
        blocksLaunch: true,
        actionKind: "scroll_profile",
      }

  const leadSourceStep: GrowthHomeLaunchMissionSetupStep =
    hasMission && leadSearchBound
      ? {
          id: "lead_source",
          label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.lead_source,
          status: "complete",
          summary: acquisitionMission?.title ?? GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE,
          blocksLaunch: false,
          actionKind: "none",
        }
      : {
          id: "lead_source",
          label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.lead_source,
          status: !input.businessProfileApproved ? "blocked" : !hasMission ? "pending" : "pending",
          summary: !input.businessProfileApproved
            ? "I need your Growth Profile approved before I can set up a lead source."
            : !hasMission
              ? `I need the "${GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE}" mission before I can find companies.`
              : "I need a lead search connected before I can begin researching companies.",
          blocksLaunch: true,
          actionKind: !input.businessProfileApproved
            ? "scroll_profile"
            : !hasMission
              ? "create_mission"
              : "scroll_find_leads",
        }

  const mailboxStep: GrowthHomeLaunchMissionSetupStep = mailboxBlocksLaunch
    ? {
        id: "mailbox_readiness",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.mailbox_readiness,
        status: "blocked",
        summary:
          input.mailboxSummary?.trim() ||
          `I need ${input.expiredMailboxes} mailbox ${input.expiredMailboxes === 1 ? "connection" : "connections"} reconnected before I can prepare outreach.`,
        blocksLaunch: true,
        actionKind: hasConnectedMailbox ? "scroll_mailbox" : "open_mailbox_wizard",
        href: hasConnectedMailbox
          ? "/growth/settings/communications/connected-mailboxes"
          : "/growth/settings/communications/connected-mailboxes/onboard",
      }
    : !hasConnectedMailbox
      ? {
          id: "mailbox_readiness",
          label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.mailbox_readiness,
          status: "pending",
          summary: "I need an email account before I can prepare outreach.",
          blocksLaunch: true,
          actionKind: "open_mailbox_wizard",
          href: "/growth/settings/communications/connected-mailboxes/onboard",
        }
      : mailboxHasWarnings
        ? {
            id: "mailbox_readiness",
            label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.mailbox_readiness,
            status: "warning",
            summary:
              input.mailboxSummary?.trim() ||
              `I found ${input.mailboxWarnings} mailbox ${input.mailboxWarnings === 1 ? "issue" : "issues"} — please review before I send outreach.`,
            blocksLaunch: false,
            actionKind: "scroll_mailbox",
          }
        : {
            id: "mailbox_readiness",
            label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.mailbox_readiness,
            status: "complete",
            summary: "My email account is ready for outreach.",
            blocksLaunch: false,
            actionKind: "none",
          }

  const approvalStep: GrowthHomeLaunchMissionSetupStep = autonomyConfigured
    ? {
        id: "approval_guardrails",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.approval_guardrails,
        status: "complete",
        summary: "I won't send outreach without your approval — my guardrails are set.",
        blocksLaunch: false,
        actionKind: "none",
      }
    : {
        id: "approval_guardrails",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.approval_guardrails,
        status: "pending",
        summary: "I need your approval on how I should work before I can run autonomously.",
        blocksLaunch: true,
        actionKind: "open_autonomy_settings",
        href: "/growth/settings/autonomy",
      }

  const calendarStep: GrowthHomeLaunchMissionSetupStep = calendarReady
    ? {
        id: "calendar_booking",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.calendar_booking,
        status: "complete",
        summary:
          input.calendarConnected && (input.bookingPagesCount ?? 0) > 0
            ? "I can offer meeting times when prospects are ready."
            : input.calendarConnected
              ? "My calendar is connected for scheduling."
              : "I have a booking page ready for meeting requests.",
        blocksLaunch: false,
        actionKind: "none",
      }
    : {
        id: "calendar_booking",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.calendar_booking,
        status: "warning",
        summary: "Connect a calendar or publish a booking page so I can offer meeting times in outreach.",
        blocksLaunch: false,
        actionKind: input.calendarConnected ? "open_booking_settings" : "open_calendar_settings",
        href: input.calendarConnected ? "/growth/settings/booking" : "/growth/settings/calendar",
      }

  const coreLaunchReady =
    input.aiTeammateOnboardingCompleted === true &&
    input.businessProfileApproved &&
    hasMission &&
    leadSearchBound &&
    hasConnectedMailbox &&
    !mailboxBlocksLaunch &&
    autonomyConfigured

  const launchStep: GrowthHomeLaunchMissionSetupStep = coreLaunchReady
    ? {
        id: "launch_ava",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.launch_ava,
        status: "complete",
        summary: "I'm ready to research companies and prepare outreach for your review.",
        blocksLaunch: false,
        actionKind: "none",
      }
    : {
        id: "launch_ava",
        label: GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS.launch_ava,
        status: "blocked",
        summary: "Complete the steps above and I'll start working for you.",
        blocksLaunch: false,
        actionKind: "none",
      }

  const steps = [
    meetAvaStep,
    growthProfileStep,
    leadSourceStep,
    mailboxStep,
    approvalStep,
    calendarStep,
    launchStep,
  ]

  const completedStepCount = steps.filter((step) => step.status === "complete").length
  const totalStepCount = steps.length
  const progressPercent = computeStartupProgressPercent({
    completedSteps: completedStepCount,
    totalSteps: totalStepCount,
  })

  const blockingSteps = steps.filter((step) => step.blocksLaunch && step.status !== "complete")
  const setupComplete = coreLaunchReady
  const readyForLaunch = setupComplete
  const readyForMonitoring = setupComplete
  const currentStepId =
    blockingSteps[0]?.id ??
    steps.find((step) => step.status === "pending" || step.status === "warning")?.id ??
    null

  const showCard = !setupComplete

  return {
    qaMarker: GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER,
    readOnly: true,
    showCard,
    setupComplete,
    readyForLaunch,
    readyForMonitoring,
    completionCopy: readyForLaunch ? GROWTH_AVA_LAUNCH_MISSION_SETUP_COMPLETE_COPY : null,
    currentStepId,
    acquisitionMissionId: acquisitionMission?.id ?? null,
    steps,
    progressPercent,
    completedStepCount,
    totalStepCount,
  }
}
