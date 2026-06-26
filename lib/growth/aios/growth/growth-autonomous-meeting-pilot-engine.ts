/** GE-AIOS-GROWTH-5G — Autonomous Meeting Agent Pilot engine (client-safe, deterministic). */

import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthAutonomousExecutionRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import type { GrowthAutonomousOutreachPreparationRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthMissionAllocationRecommendation } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type {
  AiOsOperationsMeetingAgentStatus,
  GrowthAutonomousMeetingDecisionSummary,
  GrowthAutonomousMeetingPilotControlState,
  GrowthAutonomousMeetingPilotPlanContext,
  GrowthAutonomousMeetingPilotReadModel,
  GrowthAutonomousMeetingPilotTelemetry,
  GrowthAutonomousMeetingPreparationPackage,
  GrowthAutonomousMeetingPreparedAssetSummary,
  GrowthAutonomousMeetingRunRecord,
  GrowthAutonomousMeetingWakeCondition,
  GrowthRevenueOperatorMeetingSupervision,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import {
  GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT,
  GROWTH_AUTONOMOUS_MEETING_PILOT_ALLOWED_WORKFLOW,
  GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_MEETING_PILOT_MIN_CONFIDENCE,
  GROWTH_AUTONOMOUS_MEETING_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_MEETING_PILOT_RULE,
  GROWTH_AUTONOMOUS_MEETING_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_MEETING_PILOT_WAKE_CONDITIONS,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { AiMeetingPrepGeneratedArtifacts } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"

const RECENT_PACKAGE_MS = 24 * 60 * 60 * 1000

export const GROWTH_AUTONOMOUS_MEETING_DISABLED_AGENT_KINDS = [] as const satisfies readonly GrowthAgentKind[]

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isMeetingAgentSchedulerActive(
  controlState: GrowthAutonomousMeetingPilotControlState,
): boolean {
  return controlState === "active"
}

export function resolveMeetingPreparationConfidence(snapshot: GrowthLeadResearchWorkflowSnapshot | null): number {
  if (!snapshot) return 0
  return snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? 0
}

export function hasRequiredContactData(input: {
  contactName: string | null | undefined
  email: string | null | undefined
  phone: string | null | undefined
  decisionMakerCount: number
}): boolean {
  return Boolean(
    input.contactName?.trim() ||
      input.email?.trim() ||
      input.phone?.trim() ||
      input.decisionMakerCount > 0,
  )
}

export function hasCompletedInternalExecution(input: {
  executionRuns: GrowthAutonomousExecutionRunRecord[]
  leadId: string
}): boolean {
  return input.executionRuns.some(
    (run) => run.leadId === input.leadId && run.outcome === "completed" && run.workflowType === "research_company",
  )
}

export function hasCompletedOutreachPreparationWithApproval(input: {
  outreachRuns: GrowthAutonomousOutreachPreparationRunRecord[]
  leadId: string
}): boolean {
  return input.outreachRuns.some(
    (run) =>
      run.leadId === input.leadId &&
      run.outcome === "completed" &&
      run.approvalPackage != null &&
      run.approvalPackage.pendingHumanApproval,
  )
}

export function evaluateMeetingMemoryReadiness(input: {
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  hasContactData: boolean
}): { sufficient: boolean; blockReason: string | null } {
  if (!input.snapshot?.researchRunId) {
    return { sufficient: false, blockReason: "Required research context is missing." }
  }
  if (!input.snapshot.qualification) {
    return { sufficient: false, blockReason: "Qualification context missing for meeting preparation." }
  }
  if (!input.snapshot.executionPlan) {
    return { sufficient: false, blockReason: "Execution plan missing — planning must complete first." }
  }
  if (input.snapshot.workflowStatus === "failed" || input.snapshot.workflowStatus === "blocked") {
    return { sufficient: false, blockReason: "Workflow blocked — meeting preparation not eligible." }
  }
  if (!input.hasContactData) {
    return { sufficient: false, blockReason: "Required contact data is missing for meeting preparation." }
  }
  return { sufficient: true, blockReason: null }
}

export function evaluateMeetingPreparationGateReadiness(input: {
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  executionRuns: GrowthAutonomousExecutionRunRecord[]
  outreachRuns: GrowthAutonomousOutreachPreparationRunRecord[]
  leadId: string
  confidence: number
  hasContactData: boolean
}): { eligible: boolean; blockReason: string | null } {
  const memory = evaluateMeetingMemoryReadiness({
    snapshot: input.snapshot,
    hasContactData: input.hasContactData,
  })
  if (!memory.sufficient) {
    return { eligible: false, blockReason: memory.blockReason }
  }

  if (!hasCompletedInternalExecution({ executionRuns: input.executionRuns, leadId: input.leadId })) {
    return { eligible: false, blockReason: "Internal execution has not completed successfully." }
  }

  if (
    !hasCompletedOutreachPreparationWithApproval({
      outreachRuns: input.outreachRuns,
      leadId: input.leadId,
    })
  ) {
    return {
      eligible: false,
      blockReason: "Human outreach approval package missing — outreach preparation must complete first.",
    }
  }

  if (input.confidence < GROWTH_AUTONOMOUS_MEETING_PILOT_MIN_CONFIDENCE) {
    return {
      eligible: false,
      blockReason: `Meeting confidence below threshold (${GROWTH_AUTONOMOUS_MEETING_PILOT_MIN_CONFIDENCE}).`,
    }
  }

  return { eligible: true, blockReason: null }
}

export function countMeetingPreparationRunsInWindow(input: {
  runs: GrowthAutonomousMeetingRunRecord[]
  generatedAt: string
  windowMs: number
  leadId?: string
  outcomes?: GrowthAutonomousMeetingRunRecord["outcome"][]
}): number {
  const now = Date.parse(input.generatedAt)
  return input.runs.filter((run) => {
    if (input.leadId && run.leadId !== input.leadId) return false
    if (input.outcomes && !input.outcomes.includes(run.outcome)) return false
    if (run.outcome === "skipped") return false
    const started = Date.parse(run.startedAt)
    return Number.isFinite(started) && now - started <= input.windowMs
  }).length
}

export function isLeadInMeetingPreparationFailureCooldown(input: {
  runs: GrowthAutonomousMeetingRunRecord[]
  leadId: string
  generatedAt: string
}): boolean {
  const cooldownMs = GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.cooldownAfterFailureMinutes * 60 * 1000
  const now = Date.parse(input.generatedAt)
  const lastFailed = input.runs
    .filter((run) => run.leadId === input.leadId && run.outcome === "failed")
    .map((run) => parseTime(run.completedAt))
    .sort((a, b) => b - a)[0]

  return lastFailed > 0 && now - lastFailed < cooldownMs
}

export function enforceMeetingAgentBudget(input: {
  runs: GrowthAutonomousMeetingRunRecord[]
  generatedAt: string
  leadId?: string
}): { allowed: boolean; skipReason: string | null } {
  const hourCount = countMeetingPreparationRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 60 * 60 * 1000,
  })
  if (hourCount >= GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerHour) {
    return {
      allowed: false,
      skipReason: `Hourly budget exhausted (${GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerHour}/hr).`,
    }
  }

  const dayCount = countMeetingPreparationRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 24 * 60 * 60 * 1000,
  })
  if (dayCount >= GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerDay) {
    return {
      allowed: false,
      skipReason: `Daily budget exhausted (${GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerDay}/day).`,
    }
  }

  if (input.leadId) {
    const leadRetries = countMeetingPreparationRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
      leadId: input.leadId,
      outcomes: ["failed", "completed"],
    })
    if (leadRetries >= GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRetriesPerLeadPerDay) {
      return {
        allowed: false,
        skipReason: `Lead retry limit reached (${GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRetriesPerLeadPerDay}/day).`,
      }
    }

    if (
      isLeadInMeetingPreparationFailureCooldown({
        runs: input.runs,
        leadId: input.leadId,
        generatedAt: input.generatedAt,
      })
    ) {
      return {
        allowed: false,
        skipReason: `Cooldown active after failed preparation (${GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.cooldownAfterFailureMinutes} min).`,
      }
    }
  }

  return { allowed: true, skipReason: null }
}

export function hasRecentMeetingPreparationPackage(input: {
  runs: GrowthAutonomousMeetingRunRecord[]
  leadId: string
  generatedAt: string
}): boolean {
  const now = Date.parse(input.generatedAt)
  return input.runs.some(
    (run) =>
      run.leadId === input.leadId &&
      run.outcome === "completed" &&
      run.preparationPackage != null &&
      now - parseTime(run.completedAt) <= RECENT_PACKAGE_MS,
  )
}

export function evaluateMeetingPreparationWakeCondition(input: {
  leadId: string
  runs: GrowthAutonomousMeetingRunRecord[]
  generatedAt: string
  explicitTrigger?: GrowthAutonomousMeetingWakeCondition | null
  gateReadiness: ReturnType<typeof evaluateMeetingPreparationGateReadiness>
}): GrowthAutonomousMeetingWakeCondition | null {
  if (input.explicitTrigger) return input.explicitTrigger
  if (!input.gateReadiness.eligible) return null
  if (hasRecentMeetingPreparationPackage({ runs: input.runs, leadId: input.leadId, generatedAt: input.generatedAt })) {
    return null
  }

  const lastFailed = input.runs.filter((run) => run.leadId === input.leadId && run.outcome === "failed").at(-1)
  if (lastFailed) return "stale_meeting_package"

  return "outreach_preparation_completed"
}

export type GrowthMeetingPreparationWakeCandidate = {
  leadId: string
  companyName: string | null
  confidence: number
  missionType: string | null
}

export function selectMeetingPreparationWakeCandidates(input: {
  outreachRuns: GrowthAutonomousOutreachPreparationRunRecord[]
  rankedMissions: GrowthMissionAllocationRecommendation[]
  snapshotsByLeadId: Map<string, GrowthLeadResearchWorkflowSnapshot | null>
}): GrowthMeetingPreparationWakeCandidate[] {
  const outreachReadyLeadIds = new Set(
    input.outreachRuns
      .filter((run) => run.outcome === "completed" && run.approvalPackage?.pendingHumanApproval)
      .map((run) => run.leadId),
  )

  const prioritized = input.rankedMissions.filter(
    (row) =>
      row.missionType === "prepare_meeting" &&
      outreachReadyLeadIds.has(row.leadId) &&
      (row.allocationStatus === "allocated" || row.allocationStatus === "waiting_for_human"),
  )

  const candidates: GrowthMeetingPreparationWakeCandidate[] = []
  for (const row of prioritized) {
    const snapshot = input.snapshotsByLeadId.get(row.leadId) ?? null
    candidates.push({
      leadId: row.leadId,
      companyName: row.companyName,
      confidence: resolveMeetingPreparationConfidence(snapshot),
      missionType: row.missionType,
    })
  }

  if (candidates.length === 0) {
    for (const leadId of outreachReadyLeadIds) {
      const snapshot = input.snapshotsByLeadId.get(leadId) ?? null
      candidates.push({
        leadId,
        companyName: snapshot?.companyName ?? null,
        confidence: resolveMeetingPreparationConfidence(snapshot),
        missionType: "prepare_meeting",
      })
    }
  }

  return candidates
}

export function isRevenueOperatorMeetingPreparationBlocked(input: {
  allocationStatus: GrowthMissionAllocationRecommendation["allocationStatus"]
  blockers: string[]
}): boolean {
  if (input.allocationStatus === "blocked") return true
  return input.blockers.some((blocker) =>
    /revenue operator|meeting blocked|orchestration blocked|calendar blocked/i.test(blocker),
  )
}

export function buildAutonomousMeetingRunRecord(input: {
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousMeetingWakeCondition
  generatedAt: string
  outcome: GrowthAutonomousMeetingRunRecord["outcome"]
  skipReason?: string | null
  blockReason?: string | null
  packageId?: string | null
  meetingId?: string | null
  workflowType?: string | null
  confidence?: number | null
  revenueOperatorHandoff?: string | null
  preparationPackage?: GrowthAutonomousMeetingPreparationPackage | null
  durationMs?: number
}): GrowthAutonomousMeetingRunRecord {
  const durationMs = input.durationMs ?? 1800

  return {
    runId: `growth-meeting-prep-run:${input.leadId}:${input.generatedAt}`,
    leadId: input.leadId,
    companyName: input.companyName,
    wakeCondition: input.wakeCondition,
    outcome: input.outcome,
    startedAt: input.generatedAt,
    completedAt: new Date(Date.parse(input.generatedAt) + durationMs).toISOString(),
    durationMs,
    packageId: input.packageId ?? input.preparationPackage?.packageId ?? null,
    meetingId: input.meetingId ?? input.preparationPackage?.meetingId ?? null,
    workflowType: input.workflowType ?? GROWTH_AUTONOMOUS_MEETING_PILOT_ALLOWED_WORKFLOW,
    confidence: input.confidence ?? null,
    skipReason: input.skipReason ?? null,
    blockReason: input.blockReason ?? null,
    revenueOperatorHandoff: input.revenueOperatorHandoff ?? null,
    preparationPackage: input.preparationPackage ?? null,
  }
}

export function buildAutonomousMeetingPilotTelemetry(input: {
  runs: GrowthAutonomousMeetingRunRecord[]
  generatedAt: string
  eligibleLeads: number
  activeRuns: number
}): GrowthAutonomousMeetingPilotTelemetry {
  const completed = input.runs.filter((run) => run.outcome === "completed")
  const failed = input.runs.filter((run) => run.outcome === "failed")
  const skipped = input.runs.filter((run) => run.outcome === "skipped")
  const blocked = skipped.filter((run) => Boolean(run.blockReason || run.skipReason?.includes("blocked")))

  return {
    successfulRuns: completed.length,
    failedRuns: failed.length,
    skippedRuns: skipped.length,
    eligibleLeads: input.eligibleLeads,
    briefsPrepared: completed.reduce((sum, run) => sum + (run.preparationPackage?.generatedAssets.length ?? 0), 0),
    preparationPackagesWaiting: completed.filter((run) => run.preparationPackage?.pendingHumanApproval).length,
    blockedPreparations: blocked.length,
    budgetConsumptionHour: countMeetingPreparationRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 60 * 60 * 1000,
    }),
    budgetConsumptionDay: countMeetingPreparationRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
    }),
    activeRuns: input.activeRuns,
  }
}

export function buildRevenueOperatorMeetingSupervision(input: {
  controlState: GrowthAutonomousMeetingPilotControlState
  telemetry: GrowthAutonomousMeetingPilotTelemetry
  latestOutcome: string | null
}): GrowthRevenueOperatorMeetingSupervision {
  const budgetNearLimit =
    input.telemetry.budgetConsumptionHour >= GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerHour - 2

  return {
    approveWakeRecommendation:
      input.controlState === "active"
        ? "Meeting Agent wake approved for preparation-only briefs — human conducts meeting; no booking or calendar writes."
        : "Meeting Agent wake blocked — pilot not active.",
    budgetMonitorSummary: `${input.telemetry.budgetConsumptionHour}/${GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerHour} hourly · ${input.telemetry.budgetConsumptionDay}/${GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET.maxRunsPerDay} daily.`,
    failureMonitorSummary:
      input.telemetry.failedRuns > 0
        ? `${input.telemetry.failedRuns} failed meeting preparation runs — review before expanding scope.`
        : "No failed autonomous meeting preparation runs recorded.",
    pauseRecommendation:
      budgetNearLimit || input.telemetry.failedRuns >= 3
        ? "Recommend pausing Meeting Agent pilot until budget resets or failures reviewed."
        : null,
    escalationRecommendation:
      input.telemetry.failedRuns >= 6
        ? "Escalate to Revenue Operator — disable pilot and audit preparation gates."
        : null,
    latestOutcomeRecommendation: input.latestOutcome,
  }
}

export function applyMeetingPilotControlTransition(input: {
  current: GrowthAutonomousMeetingPilotControlState
  action: "pause" | "resume" | "disable"
}): GrowthAutonomousMeetingPilotControlState {
  if (input.action === "disable") return "disabled"
  if (input.action === "pause") {
    return input.current === "disabled" ? "disabled" : "paused"
  }
  return "active"
}

export function buildAutonomousMeetingPilotReadModel(input: {
  controlState: GrowthAutonomousMeetingPilotControlState
  runs: GrowthAutonomousMeetingRunRecord[]
  generatedAt: string
  eligibleLeads?: number
  activeRuns?: number
}): GrowthAutonomousMeetingPilotReadModel {
  const telemetry = buildAutonomousMeetingPilotTelemetry({
    runs: input.runs,
    generatedAt: input.generatedAt,
    eligibleLeads: input.eligibleLeads ?? 0,
    activeRuns: input.activeRuns ?? 0,
  })

  const latestPackages: GrowthAutonomousMeetingDecisionSummary[] = input.runs
    .filter((run) => run.outcome === "completed" && run.preparationPackage)
    .slice(-8)
    .reverse()
    .map((run) => ({
      leadId: run.leadId,
      companyName: run.companyName,
      packageId: run.preparationPackage!.packageId,
      meetingId: run.preparationPackage!.meetingId,
      preparedAt: run.completedAt,
      confidence: run.preparationPackage!.confidence,
      readinessScore: run.preparationPackage!.readinessScore,
      assetCount: run.preparationPackage!.generatedAssets.length,
      outcome: run.outcome,
    }))

  const latestOutcome = input.runs.filter((run) => run.revenueOperatorHandoff).at(-1)?.revenueOperatorHandoff ?? null

  return {
    qaMarker: GROWTH_AUTONOMOUS_MEETING_PILOT_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_AUTONOMOUS_MEETING_PILOT_RULE,
    agentKind: GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT,
    schedulerMode: GROWTH_AUTONOMOUS_MEETING_PILOT_SCHEDULER_MODE,
    controlState: input.controlState,
    enabled: input.controlState === "active",
    preparationModeOnly: true,
    allowedWorkflow: GROWTH_AUTONOMOUS_MEETING_PILOT_ALLOWED_WORKFLOW,
    disabledAgentKinds: [...GROWTH_AUTONOMOUS_MEETING_DISABLED_AGENT_KINDS],
    budgetLimits: GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET,
    telemetry,
    latestPackages,
    recentRuns: [...input.runs].slice(-12).reverse(),
    revenueOperatorSupervision: buildRevenueOperatorMeetingSupervision({
      controlState: input.controlState,
      telemetry,
      latestOutcome,
    }),
    wakeConditionsSupported: GROWTH_AUTONOMOUS_MEETING_PILOT_WAKE_CONDITIONS,
  }
}

export function buildAutonomousMeetingPilotPlanContext(input: {
  leadId: string
  controlState: GrowthAutonomousMeetingPilotControlState
  runs: GrowthAutonomousMeetingRunRecord[]
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  executionRuns: GrowthAutonomousExecutionRunRecord[]
  outreachRuns: GrowthAutonomousOutreachPreparationRunRecord[]
  generatedAt: string
  hasContactData: boolean
}): GrowthAutonomousMeetingPilotPlanContext {
  const leadRuns = input.runs.filter((run) => run.leadId === input.leadId)
  const lastRun = leadRuns.at(-1) ?? null
  const confidence = resolveMeetingPreparationConfidence(input.snapshot)
  const gateReadiness = evaluateMeetingPreparationGateReadiness({
    snapshot: input.snapshot,
    executionRuns: input.executionRuns,
    outreachRuns: input.outreachRuns,
    leadId: input.leadId,
    confidence,
    hasContactData: input.hasContactData,
  })

  const wakeCondition = evaluateMeetingPreparationWakeCondition({
    leadId: input.leadId,
    runs: input.runs,
    generatedAt: input.generatedAt,
    gateReadiness,
  })

  let blockedReason = gateReadiness.blockReason
  if (input.controlState !== "active") {
    blockedReason = blockedReason ?? "Meeting preparation pilot is not active."
  }

  const lastPackage = lastRun?.preparationPackage ?? null
  let preparationPackageStatus: GrowthAutonomousMeetingPilotPlanContext["preparationPackageStatus"] = "none"
  if (lastPackage?.pendingHumanApproval) preparationPackageStatus = "waiting_approval"
  else if (lastPackage) preparationPackageStatus = "prepared"
  else if (blockedReason) preparationPackageStatus = "blocked"

  return {
    meetingAgentOwner: GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT,
    meetingReadiness:
      gateReadiness.eligible && input.controlState === "active"
        ? "ready"
        : blockedReason
          ? "blocked"
          : "pending",
    preparationPackageStatus,
    packageId: lastPackage?.packageId ?? null,
    meetingId: lastPackage?.meetingId ?? null,
    preparedAssets: lastPackage?.generatedAssets ?? [],
    meetingConfidence: lastPackage?.confidence ?? confidence,
    blockedReason,
    wakeRecommendation: wakeCondition
      ? `Meeting Agent would wake for ${wakeCondition.replaceAll("_", " ")} when pilot is active.`
      : blockedReason ?? "No autonomous meeting preparation recommended for this lead.",
    revenueOperatorHandoff: lastRun?.revenueOperatorHandoff ?? null,
    recommendedAgenda: lastPackage?.recommendedAgenda ?? null,
    expectedOutcome: lastPackage?.expectedOutcome ?? input.snapshot?.executionPlan?.expectedOutcome ?? null,
  }
}

export function buildOperationsMeetingAgentStatus(input: {
  pilot: GrowthAutonomousMeetingPilotReadModel
  configureHref: string
}): AiOsOperationsMeetingAgentStatus {
  const { telemetry } = input.pilot
  const latestRun = input.pilot.recentRuns[0] ?? null
  const latestAsset = latestRun?.preparationPackage?.generatedAssets[0] ?? null

  return {
    enabled: input.pilot.enabled,
    controlState: input.pilot.controlState,
    briefsPrepared: telemetry.briefsPrepared,
    preparationPackagesWaiting: telemetry.preparationPackagesWaiting,
    blockedPreparations: telemetry.blockedPreparations,
    eligibleLeads: telemetry.eligibleLeads,
    budgetLabel: `${telemetry.budgetConsumptionHour}/${input.pilot.budgetLimits.maxRunsPerHour} hr · ${telemetry.budgetConsumptionDay}/${input.pilot.budgetLimits.maxRunsPerDay} day`,
    latestPreparedAssetSummary: latestAsset
      ? `${latestAsset.category} · ${latestAsset.label}`
      : latestRun
        ? `${latestRun.outcome} · ${latestRun.companyName ?? latestRun.leadId}`
        : null,
    lastRunSummary: latestRun
      ? `${latestRun.outcome} · ${latestRun.wakeCondition.replaceAll("_", " ")} · confidence ${latestRun.confidence?.toFixed(2) ?? "n/a"}`
      : null,
    configureHref: input.configureHref,
  }
}

export function summarizePreparedMeetingAssetsForPackage(input: {
  artifacts: AiMeetingPrepGeneratedArtifacts
  accountSummary: string
  roiDiscussion: string
  followUpRecommendations: string
}): GrowthAutonomousMeetingPreparedAssetSummary[] {
  const talkingPoints = input.artifacts.stakeholder_analysis
    .flatMap((item) => item.talking_points)
    .slice(0, 4)
    .join(" ")

  return [
    {
      category: "meeting_brief",
      label: "Meeting brief",
      preview: input.artifacts.executive_brief.slice(0, 160),
      preparationOnly: true,
    },
    {
      category: "account_summary",
      label: "Account summary",
      preview: input.accountSummary.slice(0, 160),
      preparationOnly: true,
    },
    {
      category: "decision_maker_summary",
      label: "Decision-maker summary",
      preview: input.artifacts.stakeholder_analysis
        .slice(0, 2)
        .map((item) => `${item.contact_name ?? "Contact"} (${item.role_category})`)
        .join(" · ")
        .slice(0, 160),
      preparationOnly: true,
    },
    {
      category: "objections",
      label: "Likely objections",
      preview: input.artifacts.likely_objections
        .slice(0, 2)
        .map((item) => item.objection)
        .join(" · ")
        .slice(0, 160),
      preparationOnly: true,
    },
    {
      category: "talking_points",
      label: "Talking points",
      preview: talkingPoints.slice(0, 160),
      preparationOnly: true,
    },
    {
      category: "discovery_questions",
      label: "Discovery questions",
      preview: input.artifacts.discovery_questions.slice(0, 3).join(" ").slice(0, 160),
      preparationOnly: true,
    },
    {
      category: "roi_discussion",
      label: "ROI discussion",
      preview: input.roiDiscussion.slice(0, 160),
      preparationOnly: true,
    },
    {
      category: "recommended_agenda",
      label: "Recommended agenda",
      preview: input.artifacts.suggested_agenda
        .slice(0, 3)
        .map((item) => `${item.segment} (${item.duration_minutes}m)`)
        .join(" · ")
        .slice(0, 160),
      preparationOnly: true,
    },
    {
      category: "follow_up_recommendations",
      label: "Follow-up recommendations",
      preview: input.followUpRecommendations.slice(0, 160),
      preparationOnly: true,
    },
  ]
}
