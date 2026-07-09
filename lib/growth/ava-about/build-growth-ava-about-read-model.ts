/** GE-AIOS-19C-2F — About Your AI read model (client-safe synthesizer). */

import {
  GROWTH_AUTONOMY_CAPABILITY_OPERATOR_DESCRIPTIONS,
  GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS,
  GROWTH_AUTONOMY_CAPABILITY_OPERATOR_LABELS,
  GROWTH_AUTONOMY_OPERATING_MODE_OPERATOR_COPY,
  resolveGrowthAutonomyOutboundStatusLabel,
} from "@/lib/growth/autonomy/growth-autonomy-operator-ui"
import type { GrowthAutonomySettingsViewModel } from "@/lib/growth/autonomy/growth-autonomy-settings-service"
import type { GrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-types"
import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import type { GrowthOperatorSetupHealthPayload } from "@/lib/growth/operational/ge-v1-2-operator-setup-health-types"
import { buildGrowthTrainingOverviewReadModel } from "@/lib/growth/training/build-growth-training-overview-read-model"
import type { BusinessProfileRecord } from "@/lib/growth/business-profile/business-profile-types"
import type { GrowthHomeOrganizationalKnowledgePayload } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { GrowthHomeLaunchMissionSetupViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"
import type { GrowthHomeAiEmployeeStatus } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import { GROWTH_SALES_OPERATIONS_CENTER_ROUTE } from "@/lib/growth/operations-center/growth-sales-operations-center-types"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"
import { buildHomeWorkItemPresentation } from "@/lib/growth/home/growth-home-runtime-presenter"
import type { AvaDailyBriefing } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { buildTeammateAboutIntroduction } from "@/lib/workspace/ai-teammate-voice"
import {
  GROWTH_AVA_ABOUT_WORKSPACE_19C_2F_QA_MARKER,
  type GrowthAvaAboutCapabilityRow,
  type GrowthAvaAboutCapabilityStatus,
  type GrowthAvaAboutReadModel,
  type GrowthAvaAboutToolRow,
} from "@/lib/growth/ava-about/growth-ava-about-workspace-types"

export type BuildGrowthAvaAboutReadModelInput = {
  teammate: AiTeammatePresentation
  employeeStatus: GrowthHomeAiEmployeeStatus
  dailyBriefing: AvaDailyBriefing | null
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload | null
  autonomy: GrowthAutonomySettingsViewModel | null
  setupHealth: GrowthOperatorSetupHealthPayload | null
  activeApproved: BusinessProfileRecord | null
  latestDraft: BusinessProfileRecord | null
  launchSetup: GrowthHomeLaunchMissionSetupViewModel | null
  organizationalKnowledge: GrowthHomeOrganizationalKnowledgePayload | null
}

function capabilityStatusLabel(status: GrowthAvaAboutCapabilityStatus): string {
  if (status === "available") return "Available"
  if (status === "requires_setup") return "Requires setup"
  if (status === "coming_soon") return "Coming soon"
  return "Disabled"
}

function resolveCapabilityStatus(capability: {
  id: GrowthAutonomyCapability
  enabled: boolean
  editable: boolean
  locked: boolean
}): GrowthAvaAboutCapabilityStatus {
  if (!capability.editable) return "coming_soon"
  if (capability.locked) return "requires_setup"
  if (capability.enabled) return "available"
  return "disabled"
}

function buildCapabilities(autonomy: GrowthAutonomySettingsViewModel | null): GrowthAvaAboutCapabilityRow[] {
  if (!autonomy) {
    return GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS.flatMap((group) =>
      group.ids.map((id) => ({
        id,
        label: GROWTH_AUTONOMY_CAPABILITY_OPERATOR_LABELS[id],
        description: GROWTH_AUTONOMY_CAPABILITY_OPERATOR_DESCRIPTIONS[id] ?? null,
        status: "requires_setup" as const,
        statusLabel: capabilityStatusLabel("requires_setup"),
        href: GROWTH_HOME_STARTUP_STEP_PATHS.autonomy,
      })),
    )
  }

  const byId = new Map(autonomy.capabilities.map((row) => [row.id, row]))
  return GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS.flatMap((group) =>
    group.ids.map((id) => {
      const row = byId.get(id)
      const status = row
        ? resolveCapabilityStatus(row)
        : ("requires_setup" as const)
      return {
        id,
        label: GROWTH_AUTONOMY_CAPABILITY_OPERATOR_LABELS[id],
        description: GROWTH_AUTONOMY_CAPABILITY_OPERATOR_DESCRIPTIONS[id] ?? null,
        status,
        statusLabel: capabilityStatusLabel(status),
        href: status === "requires_setup" ? GROWTH_HOME_STARTUP_STEP_PATHS.autonomy : null,
      }
    }),
  )
}

function buildTools(input: BuildGrowthAvaAboutReadModelInput): GrowthAvaAboutToolRow[] {
  const training = buildGrowthTrainingOverviewReadModel({
    activeApproved: input.activeApproved,
    latestDraft: input.latestDraft,
    organizationalKnowledge: input.organizationalKnowledge,
    launchSetup: input.launchSetup,
  })

  const setupItems: GrowthAvaAboutToolRow[] = (input.setupHealth?.items ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    connected: item.status === "ok",
    summary:
      item.status === "ok"
        ? `I'm connected — ${String(item.value)}`
        : item.status === "warn"
          ? `I'm partially set up — ${item.detail ?? String(item.value)}`
          : `I'm still waiting — ${item.detail ?? "needs setup"}`,
    href: item.href,
  }))

  const trainingTools: GrowthAvaAboutToolRow[] = training.areas
    .filter((area) => area.id !== "learned")
    .map((area) => ({
      id: `training-${area.id}`,
      label: area.label,
      connected: area.status === "complete" || area.status === "available",
      summary:
        area.status === "complete" || area.status === "available"
          ? area.summary
          : area.coachingHint ?? area.summary,
      href: area.href,
    }))

  const learnedCount =
    input.organizationalKnowledge?.store.items.filter((item) => item.active && !item.superseded_by)
      .length ?? 0

  const memoryTool: GrowthAvaAboutToolRow = {
    id: "organizational-knowledge",
    label: "What I've Learned",
    connected: learnedCount > 0,
    summary:
      learnedCount > 0
        ? `I've earned ${learnedCount} validated conclusion${learnedCount === 1 ? "" : "s"}.`
        : "I'm still building validated learnings from outcomes.",
    href: `${GROWTH_TRAINING_WORKSPACE_ROUTE}/learned`,
  }

  return [...setupItems, ...trainingTools, memoryTool]
}

function buildPermissions(autonomy: GrowthAutonomySettingsViewModel | null) {
  if (!autonomy) {
    return {
      canDo: { title: "I can…", items: ["Assist when autonomy settings are configured."] },
      needApproval: {
        title: "I'll always ask before…",
        items: ["Sending outreach until you configure autonomy."],
      },
    }
  }

  const canDo: string[] = []
  const needApproval: string[] = []

  for (const capability of autonomy.capabilities) {
    const label = GROWTH_AUTONOMY_CAPABILITY_OPERATOR_LABELS[capability.id]
    if (!capability.enabled) continue
    if (capability.approvalPolicy === "fully_autonomous") {
      canDo.push(label)
    } else if (capability.approvalPolicy === "conditional_approval") {
      canDo.push(`${label} (when confidence is high enough)`)
    } else {
      needApproval.push(label)
    }
  }

  if (autonomy.status.outboundLocked) {
    needApproval.push("Sending email, SMS, or voice outreach")
  }

  return {
    canDo: {
      title: "I can…",
      items: canDo.length > 0 ? canDo : ["Recommend and prepare work within your current settings."],
    },
    needApproval: {
      title: "I'll always ask before…",
      items:
        needApproval.length > 0
          ? needApproval
          : ["Anything that requires your explicit approval under current guardrails."],
    },
  }
}

function buildActivity(input: BuildGrowthAvaAboutReadModelInput): GrowthAvaAboutReadModel["activity"] {
  const summary = input.workspaceSummary
  if (!summary) return []

  const rows: GrowthAvaAboutReadModel["activity"] = []
  const research = summary.avaConsole?.researchLoopSummary
  if (research?.companiesReviewed) {
    rows.push({
      id: "companies-researched",
      label: "Companies researched",
      value: String(research.companiesReviewed),
    })
  }
  if (summary.kpis.repliesToday > 0) {
    rows.push({ id: "replies-today", label: "Replies today", value: String(summary.kpis.repliesToday) })
  }
  if (summary.kpis.emailsSentToday > 0) {
    rows.push({ id: "emails-today", label: "Outreach prepared", value: String(summary.kpis.emailsSentToday) })
  }
  if (summary.meetings.scheduled > 0) {
    rows.push({ id: "meetings", label: "Meetings scheduled", value: String(summary.meetings.scheduled) })
  }
  if (summary.operatorTasks.pendingApprovals > 0) {
    rows.push({
      id: "approvals",
      label: "Approvals waiting",
      value: String(summary.operatorTasks.pendingApprovals),
    })
  }
  const knowledgeCount =
    summary.organizationalKnowledge?.store.items.filter((item) => item.active && !item.superseded_by)
      .length ?? 0
  if (knowledgeCount > 0) {
    rows.push({ id: "knowledge", label: "Knowledge gained", value: String(knowledgeCount) })
  }

  return rows
}

export function buildGrowthAvaAboutReadModel(input: BuildGrowthAvaAboutReadModelInput): GrowthAvaAboutReadModel {
  const training = buildGrowthTrainingOverviewReadModel({
    activeApproved: input.activeApproved,
    latestDraft: input.latestDraft,
    organizationalKnowledge: input.organizationalKnowledge,
    launchSetup: input.launchSetup,
  })

  const activeWork = input.dailyBriefing?.work_manager_result?.active_work ?? null
  const nextWork =
    input.dailyBriefing?.work_manager_result?.work_plan
      ?.map((entry) =>
        input.dailyBriefing?.work_manager_result?.all_work_items.find(
          (row) => row.id === entry.work_item_id,
        ),
      )
      .find((row) => row && row.id !== activeWork?.id) ?? null

  const focusPresentation = activeWork ? buildHomeWorkItemPresentation(activeWork) : null
  const nextPresentation = nextWork ? buildHomeWorkItemPresentation(nextWork) : null

  const knowledgeItems =
    input.organizationalKnowledge?.store.items.filter((item) => item.active && !item.superseded_by) ?? []

  const autonomyMode = input.autonomy
    ? GROWTH_AUTONOMY_OPERATING_MODE_OPERATOR_COPY[input.autonomy.status.masterMode]
    : null

  return {
    qaMarker: GROWTH_AVA_ABOUT_WORKSPACE_19C_2F_QA_MARKER,
    meetIntro: buildTeammateAboutIntroduction(input.teammate),
    statusLabel: input.employeeStatus.label,
    activityLabel: input.employeeStatus.activityLabel,
    currentFocus: focusPresentation?.title ?? input.employeeStatus.activityLabel,
    nextPlannedWork: nextPresentation?.title ?? null,
    capabilities: buildCapabilities(input.autonomy),
    tools: buildTools(input),
    permissions: buildPermissions(input.autonomy),
    learning: {
      recentlyLearned: knowledgeItems.slice(0, 5).map((item) => item.finding),
      improving: training.wellUnderstood,
      needsCoaching: training.needsCoaching,
      trainingHref: GROWTH_TRAINING_WORKSPACE_ROUTE,
    },
    activity: buildActivity(input),
    autonomy: {
      modeTitle: autonomyMode?.title ?? "Not configured",
      modeDescription: autonomyMode?.description ?? "Autonomy settings are not loaded yet.",
      safetyNote: autonomyMode?.safetyNote ?? "Configure autonomy to set guardrails.",
      outboundLabel: input.autonomy
        ? resolveGrowthAutonomyOutboundStatusLabel(input.autonomy.status)
        : "Unknown",
      paused: input.autonomy?.status.autonomyPaused ?? false,
      settingsHref: GROWTH_HOME_STARTUP_STEP_PATHS.autonomy,
    },
    identitySettingsHref: GROWTH_HOME_STARTUP_STEP_PATHS.aiTeammate,
    operationsHref: GROWTH_SALES_OPERATIONS_CENTER_ROUTE,
    trainingHref: GROWTH_TRAINING_WORKSPACE_ROUTE,
    degraded: !input.workspaceSummary || !input.autonomy,
    degradedMessage:
      !input.workspaceSummary || !input.autonomy
        ? "Some details will fill in once workspace runtime and autonomy settings are available."
        : null,
  }
}
