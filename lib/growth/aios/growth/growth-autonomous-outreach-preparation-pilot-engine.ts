/** GE-AIOS-GROWTH-5F — Autonomous Outreach Preparation Agent Pilot engine (client-safe, deterministic). */

import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthAutonomousExecutionRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import type { GrowthMissionAllocationRecommendation } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type {
  AiOsOperationsOutreachAgentStatus,
  GrowthAutonomousOutreachApprovalPackage,
  GrowthAutonomousOutreachPreparationDecisionSummary,
  GrowthAutonomousOutreachPreparationPilotControlState,
  GrowthAutonomousOutreachPreparationPilotPlanContext,
  GrowthAutonomousOutreachPreparationPilotReadModel,
  GrowthAutonomousOutreachPreparationPilotTelemetry,
  GrowthAutonomousOutreachPreparationRunRecord,
  GrowthAutonomousOutreachPreparationWakeCondition,
  GrowthAutonomousOutreachPreparedAssetSummary,
  GrowthRevenueOperatorOutreachPreparationSupervision,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_ALLOWED_WORKFLOW,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_MIN_CONFIDENCE,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_QA_MARKER,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_RULE,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_SCHEDULER_MODE,
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_WAKE_CONDITIONS,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import {
  GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE,
  hasCompletedCanonicalProspectResearch,
} from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"

const RECENT_PACKAGE_MS = 24 * 60 * 60 * 1000

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_DISABLED_AGENT_KINDS = [
  "meeting_agent",
] as const satisfies readonly GrowthAgentKind[]

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isOutreachPreparationAgentSchedulerActive(
  controlState: GrowthAutonomousOutreachPreparationPilotControlState,
): boolean {
  return controlState === "active"
}

export function resolveOutreachPreparationConfidence(snapshot: GrowthLeadResearchWorkflowSnapshot | null): number {
  if (!snapshot) return 0
  return snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? 0
}

export function evaluateOutreachMemoryReadiness(snapshot: GrowthLeadResearchWorkflowSnapshot | null): {
  sufficient: boolean
  blockReason: string | null
} {
  if (!snapshot?.researchRunId) {
    return { sufficient: false, blockReason: "Required research context is missing." }
  }
  if (!snapshot.qualification) {
    return { sufficient: false, blockReason: "Qualification context missing for outreach preparation." }
  }
  if (!snapshot.executionPlan) {
    return { sufficient: false, blockReason: "Execution plan missing — planning must complete first." }
  }
  if (snapshot.workflowStatus === "failed") {
    return { sufficient: false, blockReason: "Workflow blocked — outreach preparation not eligible." }
  }
  if (
    snapshot.workflowStatus === "blocked" &&
    (snapshot.qualification?.confidence ?? 0) < GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE
  ) {
    return { sufficient: false, blockReason: "Workflow blocked — outreach preparation not eligible." }
  }
  return { sufficient: true, blockReason: null }
}

export function hasCompletedInternalExecution(input: {
  executionRuns: GrowthAutonomousExecutionRunRecord[]
  leadId: string
  snapshot?: GrowthLeadResearchWorkflowSnapshot | null
}): boolean {
  if (
    input.executionRuns.some(
      (run) =>
        run.leadId === input.leadId &&
        run.outcome === "completed" &&
        run.workflowType === "research_company",
    )
  ) {
    return true
  }
  return hasCompletedCanonicalProspectResearch({
    snapshot: input.snapshot ?? null,
    leadId: input.leadId,
  })
}

export function evaluateOutreachPreparationGateReadiness(input: {
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  executionRuns: GrowthAutonomousExecutionRunRecord[]
  leadId: string
  confidence: number
}): { eligible: boolean; blockReason: string | null } {
  const memory = evaluateOutreachMemoryReadiness(input.snapshot)
  if (!memory.sufficient) {
    return { eligible: false, blockReason: memory.blockReason }
  }

  if (
    !hasCompletedInternalExecution({
      executionRuns: input.executionRuns,
      leadId: input.leadId,
      snapshot: input.snapshot,
    })
  ) {
    return { eligible: false, blockReason: "Internal execution has not completed successfully." }
  }

  if (input.confidence < GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_MIN_CONFIDENCE) {
    return {
      eligible: false,
      blockReason: `Confidence below threshold (${GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_MIN_CONFIDENCE}).`,
    }
  }

  return { eligible: true, blockReason: null }
}

export function countOutreachPreparationRunsInWindow(input: {
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  generatedAt: string
  windowMs: number
  leadId?: string
  outcomes?: GrowthAutonomousOutreachPreparationRunRecord["outcome"][]
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

export function isLeadInOutreachPreparationFailureCooldown(input: {
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  leadId: string
  generatedAt: string
}): boolean {
  const cooldownMs = GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.cooldownAfterFailureMinutes * 60 * 1000
  const now = Date.parse(input.generatedAt)
  const lastFailed = input.runs
    .filter((run) => run.leadId === input.leadId && run.outcome === "failed")
    .map((run) => parseTime(run.completedAt))
    .sort((a, b) => b - a)[0]

  return lastFailed > 0 && now - lastFailed < cooldownMs
}

export function enforceOutreachPreparationAgentBudget(input: {
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  generatedAt: string
  leadId?: string
}): { allowed: boolean; skipReason: string | null } {
  const hourCount = countOutreachPreparationRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 60 * 60 * 1000,
  })
  if (hourCount >= GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerHour) {
    return {
      allowed: false,
      skipReason: `Hourly budget exhausted (${GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerHour}/hr).`,
    }
  }

  const dayCount = countOutreachPreparationRunsInWindow({
    runs: input.runs,
    generatedAt: input.generatedAt,
    windowMs: 24 * 60 * 60 * 1000,
  })
  if (dayCount >= GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerDay) {
    return {
      allowed: false,
      skipReason: `Daily budget exhausted (${GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerDay}/day).`,
    }
  }

  if (input.leadId) {
    const leadRetries = countOutreachPreparationRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
      leadId: input.leadId,
      outcomes: ["failed", "completed"],
    })
    if (leadRetries >= GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRetriesPerLeadPerDay) {
      return {
        allowed: false,
        skipReason: `Lead retry limit reached (${GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRetriesPerLeadPerDay}/day).`,
      }
    }

    if (
      isLeadInOutreachPreparationFailureCooldown({
        runs: input.runs,
        leadId: input.leadId,
        generatedAt: input.generatedAt,
      })
    ) {
      return {
        allowed: false,
        skipReason: `Cooldown active after failed preparation (${GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.cooldownAfterFailureMinutes} min).`,
      }
    }
  }

  return { allowed: true, skipReason: null }
}

export function hasRecentOutreachApprovalPackage(input: {
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  leadId: string
  generatedAt: string
}): boolean {
  const now = Date.parse(input.generatedAt)
  return input.runs.some(
    (run) =>
      run.leadId === input.leadId &&
      run.outcome === "completed" &&
      run.approvalPackage != null &&
      now - parseTime(run.completedAt) <= RECENT_PACKAGE_MS,
  )
}

export function evaluateOutreachPreparationWakeCondition(input: {
  leadId: string
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  generatedAt: string
  explicitTrigger?: GrowthAutonomousOutreachPreparationWakeCondition | null
  gateReadiness: ReturnType<typeof evaluateOutreachPreparationGateReadiness>
}): GrowthAutonomousOutreachPreparationWakeCondition | null {
  if (input.explicitTrigger) return input.explicitTrigger
  if (!input.gateReadiness.eligible) return null
  if (hasRecentOutreachApprovalPackage({ runs: input.runs, leadId: input.leadId, generatedAt: input.generatedAt })) {
    return null
  }

  const lastFailed = input.runs.filter((run) => run.leadId === input.leadId && run.outcome === "failed").at(-1)
  if (lastFailed) return "stale_outreach_package"

  return "execution_completed"
}

export type GrowthOutreachPreparationWakeCandidate = {
  leadId: string
  companyName: string | null
  confidence: number
  missionType: string | null
}

export function selectOutreachPreparationWakeCandidates(input: {
  executionRuns: GrowthAutonomousExecutionRunRecord[]
  rankedMissions: GrowthMissionAllocationRecommendation[]
  snapshotsByLeadId: Map<string, GrowthLeadResearchWorkflowSnapshot | null>
}): GrowthOutreachPreparationWakeCandidate[] {
  const completedLeadIds = new Set<string>()
  for (const run of input.executionRuns) {
    if (run.outcome === "completed" && run.workflowType === "research_company") {
      completedLeadIds.add(run.leadId)
    }
  }
  for (const [leadId, snapshot] of input.snapshotsByLeadId.entries()) {
    if (hasCompletedCanonicalProspectResearch({ snapshot, leadId })) {
      completedLeadIds.add(leadId)
    }
  }

  const prioritized = input.rankedMissions.filter(
    (row) =>
      row.missionType === "prepare_outreach" &&
      completedLeadIds.has(row.leadId) &&
      (row.allocationStatus === "allocated" || row.allocationStatus === "waiting_for_human"),
  )

  const candidates: GrowthOutreachPreparationWakeCandidate[] = []
  for (const row of prioritized) {
    const snapshot = input.snapshotsByLeadId.get(row.leadId) ?? null
    candidates.push({
      leadId: row.leadId,
      companyName: row.companyName,
      confidence: resolveOutreachPreparationConfidence(snapshot),
      missionType: row.missionType,
    })
  }

  if (candidates.length === 0) {
    for (const leadId of completedLeadIds) {
      const snapshot = input.snapshotsByLeadId.get(leadId) ?? null
      candidates.push({
        leadId,
        companyName: snapshot?.companyName ?? null,
        confidence: resolveOutreachPreparationConfidence(snapshot),
        missionType: "prepare_outreach",
      })
    }
  }

  return candidates
}

export function isRevenueOperatorOutreachPreparationBlocked(input: {
  allocationStatus: GrowthMissionAllocationRecommendation["allocationStatus"]
  blockers: string[]
}): boolean {
  if (input.allocationStatus === "blocked") return true
  return input.blockers.some((blocker) =>
    /revenue operator|outreach blocked|orchestration blocked|outbound blocked/i.test(blocker),
  )
}

export function buildAutonomousOutreachPreparationRunRecord(input: {
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousOutreachPreparationWakeCondition
  generatedAt: string
  outcome: GrowthAutonomousOutreachPreparationRunRecord["outcome"]
  skipReason?: string | null
  blockReason?: string | null
  packageId?: string | null
  workflowType?: string | null
  confidence?: number | null
  revenueOperatorHandoff?: string | null
  approvalPackage?: GrowthAutonomousOutreachApprovalPackage | null
  durationMs?: number
}): GrowthAutonomousOutreachPreparationRunRecord {
  const durationMs = input.durationMs ?? 1800

  return {
    runId: `growth-outreach-prep-run:${input.leadId}:${input.generatedAt}`,
    leadId: input.leadId,
    companyName: input.companyName,
    wakeCondition: input.wakeCondition,
    outcome: input.outcome,
    startedAt: input.generatedAt,
    completedAt: new Date(Date.parse(input.generatedAt) + durationMs).toISOString(),
    durationMs,
    packageId: input.packageId ?? input.approvalPackage?.packageId ?? null,
    workflowType: input.workflowType ?? GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_ALLOWED_WORKFLOW,
    confidence: input.confidence ?? null,
    skipReason: input.skipReason ?? null,
    blockReason: input.blockReason ?? null,
    revenueOperatorHandoff: input.revenueOperatorHandoff ?? null,
    approvalPackage: input.approvalPackage ?? null,
  }
}

export function buildAutonomousOutreachPreparationTelemetry(input: {
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  generatedAt: string
  eligibleLeads: number
  activeRuns: number
}): GrowthAutonomousOutreachPreparationPilotTelemetry {
  const completed = input.runs.filter((run) => run.outcome === "completed")
  const failed = input.runs.filter((run) => run.outcome === "failed")
  const skipped = input.runs.filter((run) => run.outcome === "skipped")
  const blocked = skipped.filter((run) => Boolean(run.blockReason || run.skipReason?.includes("blocked")))

  return {
    successfulRuns: completed.length,
    failedRuns: failed.length,
    skippedRuns: skipped.length,
    eligibleLeads: input.eligibleLeads,
    draftsPrepared: completed.reduce((sum, run) => sum + (run.approvalPackage?.generatedAssets.length ?? 0), 0),
    approvalPackagesWaiting: completed.filter((run) => run.approvalPackage?.pendingHumanApproval).length,
    blockedPreparations: blocked.length,
    budgetConsumptionHour: countOutreachPreparationRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 60 * 60 * 1000,
    }),
    budgetConsumptionDay: countOutreachPreparationRunsInWindow({
      runs: input.runs,
      generatedAt: input.generatedAt,
      windowMs: 24 * 60 * 60 * 1000,
    }),
    activeRuns: input.activeRuns,
  }
}

export function buildRevenueOperatorOutreachPreparationSupervision(input: {
  controlState: GrowthAutonomousOutreachPreparationPilotControlState
  telemetry: GrowthAutonomousOutreachPreparationPilotTelemetry
  latestOutcome: string | null
}): GrowthRevenueOperatorOutreachPreparationSupervision {
  const budgetNearLimit =
    input.telemetry.budgetConsumptionHour >=
    GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerHour - 2

  return {
    approveWakeRecommendation:
      input.controlState === "active"
        ? "Outreach Agent wake approved for draft-only preparation — human approval required before send."
        : "Outreach Agent wake blocked — pilot not active.",
    budgetMonitorSummary: `${input.telemetry.budgetConsumptionHour}/${GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerHour} hourly · ${input.telemetry.budgetConsumptionDay}/${GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET.maxRunsPerDay} daily.`,
    failureMonitorSummary:
      input.telemetry.failedRuns > 0
        ? `${input.telemetry.failedRuns} failed preparation runs — review before expanding scope.`
        : "No failed autonomous outreach preparation runs recorded.",
    pauseRecommendation:
      budgetNearLimit || input.telemetry.failedRuns >= 3
        ? "Recommend pausing Outreach preparation pilot until budget resets or failures reviewed."
        : null,
    escalationRecommendation:
      input.telemetry.failedRuns >= 6
        ? "Escalate to Revenue Operator — disable pilot and audit draft gates."
        : null,
    latestOutcomeRecommendation: input.latestOutcome,
  }
}

export function applyOutreachPreparationPilotControlTransition(input: {
  current: GrowthAutonomousOutreachPreparationPilotControlState
  action: "pause" | "resume" | "disable"
}): GrowthAutonomousOutreachPreparationPilotControlState {
  if (input.action === "disable") return "disabled"
  if (input.action === "pause") {
    return input.current === "disabled" ? "disabled" : "paused"
  }
  return "active"
}

export function buildAutonomousOutreachPreparationPilotReadModel(input: {
  controlState: GrowthAutonomousOutreachPreparationPilotControlState
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  generatedAt: string
  eligibleLeads?: number
  activeRuns?: number
}): GrowthAutonomousOutreachPreparationPilotReadModel {
  const telemetry = buildAutonomousOutreachPreparationTelemetry({
    runs: input.runs,
    generatedAt: input.generatedAt,
    eligibleLeads: input.eligibleLeads ?? 0,
    activeRuns: input.activeRuns ?? 0,
  })

  const latestPackages: GrowthAutonomousOutreachPreparationDecisionSummary[] = input.runs
    .filter((run) => run.outcome === "completed" && run.approvalPackage)
    .slice(-8)
    .reverse()
    .map((run) => ({
      leadId: run.leadId,
      companyName: run.companyName,
      packageId: run.approvalPackage!.packageId,
      preparedAt: run.completedAt,
      confidence: run.approvalPackage!.confidence,
      recommendedChannel: run.approvalPackage!.recommendedChannel,
      assetCount: run.approvalPackage!.generatedAssets.length,
      outcome: run.outcome,
    }))

  const latestOutcome = input.runs.filter((run) => run.revenueOperatorHandoff).at(-1)?.revenueOperatorHandoff ?? null

  return {
    qaMarker: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_RULE,
    agentKind: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT,
    schedulerMode: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_SCHEDULER_MODE,
    controlState: input.controlState,
    enabled: input.controlState === "active",
    preparationModeOnly: true,
    allowedWorkflow: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_ALLOWED_WORKFLOW,
    disabledAgentKinds: [...GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_DISABLED_AGENT_KINDS],
    budgetLimits: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET,
    telemetry,
    latestPackages,
    recentRuns: [...input.runs].slice(-12).reverse(),
    revenueOperatorSupervision: buildRevenueOperatorOutreachPreparationSupervision({
      controlState: input.controlState,
      telemetry,
      latestOutcome,
    }),
    wakeConditionsSupported: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_WAKE_CONDITIONS,
  }
}

export function buildAutonomousOutreachPreparationPilotPlanContext(input: {
  leadId: string
  controlState: GrowthAutonomousOutreachPreparationPilotControlState
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  snapshot: GrowthLeadResearchWorkflowSnapshot | null
  executionRuns: GrowthAutonomousExecutionRunRecord[]
  generatedAt: string
}): GrowthAutonomousOutreachPreparationPilotPlanContext {
  const leadRuns = input.runs.filter((run) => run.leadId === input.leadId)
  const lastRun = leadRuns.at(-1) ?? null
  const confidence = resolveOutreachPreparationConfidence(input.snapshot)
  const gateReadiness = evaluateOutreachPreparationGateReadiness({
    snapshot: input.snapshot,
    executionRuns: input.executionRuns,
    leadId: input.leadId,
    confidence,
  })

  const wakeCondition = evaluateOutreachPreparationWakeCondition({
    leadId: input.leadId,
    runs: input.runs,
    generatedAt: input.generatedAt,
    gateReadiness,
  })

  let blockedReason = gateReadiness.blockReason
  if (input.controlState !== "active") {
    blockedReason = blockedReason ?? "Outreach preparation pilot is not active."
  }

  const lastPackage = lastRun?.approvalPackage ?? null
  let approvalPackageStatus: GrowthAutonomousOutreachPreparationPilotPlanContext["approvalPackageStatus"] = "none"
  if (lastPackage?.pendingHumanApproval) approvalPackageStatus = "waiting_approval"
  else if (lastPackage) approvalPackageStatus = "prepared"
  else if (blockedReason) approvalPackageStatus = "blocked"

  return {
    outreachAgentOwner: GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT,
    outreachReadiness:
      gateReadiness.eligible && input.controlState === "active"
        ? "ready"
        : blockedReason
          ? "blocked"
          : "pending",
    approvalPackageStatus,
    packageId: lastPackage?.packageId ?? null,
    preparedAssets: lastPackage?.generatedAssets ?? [],
    personalizationConfidence: lastPackage?.confidence ?? confidence,
    blockedReason,
    wakeRecommendation: wakeCondition
      ? `Outreach Agent would wake for ${wakeCondition.replaceAll("_", " ")} when pilot is active.`
      : blockedReason ?? "No autonomous outreach preparation recommended for this lead.",
    revenueOperatorHandoff: lastRun?.revenueOperatorHandoff ?? null,
    recommendedChannel: lastPackage?.recommendedChannel ?? "email",
    expectedOutcome: lastPackage?.expectedOutcome ?? input.snapshot?.executionPlan?.expectedOutcome ?? null,
  }
}

export function buildOperationsOutreachAgentStatus(input: {
  pilot: GrowthAutonomousOutreachPreparationPilotReadModel
  configureHref: string
}): AiOsOperationsOutreachAgentStatus {
  const { telemetry } = input.pilot
  const latestRun = input.pilot.recentRuns[0] ?? null
  const latestAsset = latestRun?.approvalPackage?.generatedAssets[0] ?? null

  return {
    enabled: input.pilot.enabled,
    controlState: input.pilot.controlState,
    draftsPrepared: telemetry.draftsPrepared,
    approvalPackagesWaiting: telemetry.approvalPackagesWaiting,
    blockedPreparations: telemetry.blockedPreparations,
    eligibleLeads: telemetry.eligibleLeads,
    budgetLabel: `${telemetry.budgetConsumptionHour}/${input.pilot.budgetLimits.maxRunsPerHour} hr · ${telemetry.budgetConsumptionDay}/${input.pilot.budgetLimits.maxRunsPerDay} day`,
    latestPreparedAssetSummary: latestAsset
      ? `${latestAsset.channel} · ${latestAsset.label}`
      : latestRun
        ? `${latestRun.outcome} · ${latestRun.companyName ?? latestRun.leadId}`
        : null,
    configureHref: input.configureHref,
  }
}

export function summarizePreparedAssetsForPackage(input: {
  emailSubject: string | null
  emailBody: string
  smsBody: string
  linkedInDraft: string
  callTalkingPoints: string
  sendrRecommendation: string
  followUpRecommendation: string
}): GrowthAutonomousOutreachPreparedAssetSummary[] {
  return [
    {
      channel: "email",
      label: "Email",
      preview: input.emailSubject
        ? `Subject: ${input.emailSubject}\n\n${input.emailBody.slice(0, 1200)}`
        : input.emailBody.slice(0, 1200),
      draftOnly: true,
    },
    { channel: "sms", label: "SMS", preview: input.smsBody.slice(0, 400), draftOnly: true },
    { channel: "linkedin", label: "LinkedIn", preview: input.linkedInDraft.slice(0, 600), draftOnly: true },
    { channel: "call", label: "Call guide", preview: input.callTalkingPoints.slice(0, 800), draftOnly: true },
    {
      channel: "sendr",
      label: "Personalized Video",
      preview: input.sendrRecommendation.slice(0, 400),
      draftOnly: true,
    },
    {
      channel: "follow_up",
      label: "Follow-up sequence",
      preview: input.followUpRecommendation.slice(0, 400),
      draftOnly: true,
    },
  ]
}
