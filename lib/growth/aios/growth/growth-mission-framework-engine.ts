/** GE-AIOS-GROWTH-4E — Mission & Goal Planning engine (client-safe, deterministic). */

import type { GrowthAgentKind, GrowthAgentRequiredGate } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import { isAgentSchedulerActive } from "@/lib/growth/aios/growth/growth-agent-framework-permissions"
import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { RevenueOperatorEscalationLevel } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import type {
  GrowthMissionDecomposition,
  GrowthMissionDependencies,
  GrowthMissionDerivationInput,
  GrowthMissionFrameworkReadModel,
  GrowthMissionHealth,
  GrowthMissionPlanContext,
  GrowthMissionPlannerResult,
  GrowthMissionPriority,
  GrowthMissionRecord,
  GrowthMissionStatus,
  GrowthMissionType,
} from "@/lib/growth/aios/growth/growth-mission-framework-types"
import {
  GROWTH_MISSION_FRAMEWORK_QA_MARKER,
  GROWTH_MISSION_FRAMEWORK_RULE,
  GROWTH_MISSION_TYPES,
} from "@/lib/growth/aios/growth/growth-mission-framework-types"

const SUPERVISOR: GrowthAgentKind = "revenue_operator_agent"

type MissionDefinition = {
  missionType: GrowthMissionType
  objective: string
  defaultOwner: GrowthAgentKind
  completionCriteria: string
  successCriteria: string
  requiredGates: GrowthAgentRequiredGate[]
}

const MISSION_DEFINITIONS: Record<GrowthMissionType, MissionDefinition> = {
  qualify_lead: {
    missionType: "qualify_lead",
    objective: "Qualify the lead with evidence-backed fit and next action.",
    defaultOwner: "qualification_agent",
    completionCriteria: "Qualification summary captured with fit score and evidence.",
    successCriteria: "Lead marked qualified with recommended next action.",
    requiredGates: ["approval", "readiness", "handoff", "preflight", "boundary"],
  },
  enrich_account: {
    missionType: "enrich_account",
    objective: "Enrich account research and company intelligence.",
    defaultOwner: "research_agent",
    completionCriteria: "Research summary and company context captured.",
    successCriteria: "Workflow reaches research_complete or assessed.",
    requiredGates: ["boundary"],
  },
  identify_buying_committee: {
    missionType: "identify_buying_committee",
    objective: "Identify and verify buying committee contacts.",
    defaultOwner: "qualification_agent",
    completionCriteria: "Buying committee mapping complete.",
    successCriteria: "Contacts verified and committee mapped.",
    requiredGates: ["approval", "readiness", "handoff", "preflight", "boundary", "dry_run"],
  },
  prepare_outreach: {
    missionType: "prepare_outreach",
    objective: "Prepare outreach plan — outbound remains blocked in 4E.",
    defaultOwner: "outreach_agent",
    completionCriteria: "Outreach plan drafted with operator approval gate.",
    successCriteria: "Operator approves outreach before any send.",
    requiredGates: ["approval", "readiness", "handoff", "preflight", "boundary", "operator_approval"],
  },
  prepare_meeting: {
    missionType: "prepare_meeting",
    objective: "Prepare meeting brief and stakeholder context.",
    defaultOwner: "meeting_agent",
    completionCriteria: "Meeting preparation checklist complete.",
    successCriteria: "Meeting brief ready for operator review.",
    requiredGates: ["approval", "readiness", "handoff", "preflight", "boundary"],
  },
  monitor_account: {
    missionType: "monitor_account",
    objective: "Monitor account signals and maintain readiness.",
    defaultOwner: "research_agent",
    completionCriteria: "Monitoring cadence defined with triggers.",
    successCriteria: "Account remains warm with updated intelligence.",
    requiredGates: ["boundary"],
  },
  recover_failed_workflow: {
    missionType: "recover_failed_workflow",
    objective: "Recover from failed workflow or runtime state.",
    defaultOwner: SUPERVISOR,
    completionCriteria: "Failure cause documented and recovery path proposed.",
    successCriteria: "Blockers cleared and mission replanned.",
    requiredGates: ["approval", "readiness", "handoff", "preflight", "boundary", "dry_run", "runtime_pilot"],
  },
  close_opportunity: {
    missionType: "close_opportunity",
    objective: "Close or abandon the opportunity with operator rationale.",
    defaultOwner: SUPERVISOR,
    completionCriteria: "Close rationale recorded.",
    successCriteria: "Opportunity archived or won with audit trail.",
    requiredGates: ["approval", "boundary"],
  },
}

const DECOMPOSITION: Record<GrowthMissionType, GrowthMissionDecomposition> = {
  qualify_lead: {
    primaryAgent: "qualification_agent",
    supportingAgents: ["research_agent", SUPERVISOR],
    responsibilities: [
      { agentKind: "research_agent", responsibility: "Supply company research and evidence." },
      { agentKind: "qualification_agent", responsibility: "Score fit and recommend next action." },
      { agentKind: SUPERVISOR, responsibility: "Supervise handoff to planning." },
    ],
  },
  enrich_account: {
    primaryAgent: "research_agent",
    supportingAgents: [SUPERVISOR],
    responsibilities: [
      { agentKind: "research_agent", responsibility: "Run research_company intelligence path." },
      { agentKind: SUPERVISOR, responsibility: "Track enrichment completeness." },
    ],
  },
  identify_buying_committee: {
    primaryAgent: "qualification_agent",
    supportingAgents: ["planning_agent", SUPERVISOR],
    responsibilities: [
      { agentKind: "qualification_agent", responsibility: "Verify contacts and committee map." },
      { agentKind: "planning_agent", responsibility: "Prepare execution plan for committee outreach." },
      { agentKind: SUPERVISOR, responsibility: "Coordinate planning handoff." },
    ],
  },
  prepare_outreach: {
    primaryAgent: "outreach_agent",
    supportingAgents: ["planning_agent", SUPERVISOR],
    responsibilities: [
      { agentKind: "planning_agent", responsibility: "Draft outreach plan and gates." },
      { agentKind: "outreach_agent", responsibility: "Prepare messaging — no send in 4E." },
      { agentKind: SUPERVISOR, responsibility: "Enforce outbound block until approval." },
    ],
  },
  prepare_meeting: {
    primaryAgent: "meeting_agent",
    supportingAgents: ["planning_agent", SUPERVISOR],
    responsibilities: [
      { agentKind: "meeting_agent", responsibility: "Prepare meeting brief." },
      { agentKind: "planning_agent", responsibility: "Align plan with meeting objective." },
      { agentKind: SUPERVISOR, responsibility: "Track meeting readiness." },
    ],
  },
  monitor_account: {
    primaryAgent: "research_agent",
    supportingAgents: [SUPERVISOR, "planning_agent"],
    responsibilities: [
      { agentKind: "research_agent", responsibility: "Watch account signals." },
      { agentKind: "planning_agent", responsibility: "Adjust plan on signal change." },
      { agentKind: SUPERVISOR, responsibility: "Reprioritize missions on change." },
    ],
  },
  recover_failed_workflow: {
    primaryAgent: SUPERVISOR,
    supportingAgents: ["planning_agent", "execution_agent"],
    responsibilities: [
      { agentKind: SUPERVISOR, responsibility: "Diagnose failure and escalate." },
      { agentKind: "planning_agent", responsibility: "Replenish plan after recovery." },
      { agentKind: "execution_agent", responsibility: "Reference runtime gates only — no execute." },
    ],
  },
  close_opportunity: {
    primaryAgent: SUPERVISOR,
    supportingAgents: ["planning_agent", "execution_agent", "meeting_agent"],
    responsibilities: [
      { agentKind: "planning_agent", responsibility: "Document close rationale in plan." },
      { agentKind: "execution_agent", responsibility: "Confirm runtime complete or cancelled." },
      { agentKind: "meeting_agent", responsibility: "Capture meeting outcome if applicable." },
      { agentKind: SUPERVISOR, responsibility: "Supervise close and archive." },
    ],
  },
}

const DEPENDENCY_GRAPH: Record<
  GrowthMissionType,
  Pick<GrowthMissionDependencies, "prerequisites" | "blocking" | "optional" | "parallel">
> = {
  qualify_lead: {
    prerequisites: [{ missionType: "enrich_account", summary: "Research enrichment required." }],
    blocking: [],
    optional: [{ missionType: "monitor_account", summary: "Optional monitoring in parallel." }],
    parallel: [],
  },
  enrich_account: {
    prerequisites: [],
    blocking: [],
    optional: [],
    parallel: [{ missionType: "monitor_account", summary: "May monitor while enriching." }],
  },
  identify_buying_committee: {
    prerequisites: [{ missionType: "qualify_lead", summary: "Lead must be qualified first." }],
    blocking: [],
    optional: [],
    parallel: [],
  },
  prepare_outreach: {
    prerequisites: [
      { missionType: "qualify_lead", summary: "Qualification required." },
      { missionType: "identify_buying_committee", summary: "Committee mapping preferred." },
    ],
    blocking: [{ missionType: "recover_failed_workflow", summary: "Recovery blocks outreach prep." }],
    optional: [],
    parallel: [],
  },
  prepare_meeting: {
    prerequisites: [{ missionType: "qualify_lead", summary: "Qualified lead required." }],
    blocking: [{ missionType: "recover_failed_workflow", summary: "Recovery blocks meeting prep." }],
    optional: [{ missionType: "prepare_outreach", summary: "Optional outreach in parallel." }],
    parallel: [],
  },
  monitor_account: {
    prerequisites: [],
    blocking: [],
    optional: [],
    parallel: [{ missionType: "enrich_account", summary: "Often runs with enrichment." }],
  },
  recover_failed_workflow: {
    prerequisites: [],
    blocking: [
      { missionType: "prepare_outreach", summary: "Blocks outreach until recovered." },
      { missionType: "prepare_meeting", summary: "Blocks meeting until recovered." },
    ],
    optional: [],
    parallel: [],
  },
  close_opportunity: {
    prerequisites: [],
    blocking: [
      { missionType: "prepare_outreach", summary: "Close retires outreach missions." },
      { missionType: "prepare_meeting", summary: "Close retires meeting missions." },
    ],
    optional: [],
    parallel: [],
  },
}

export function getMissionDefinition(missionType: GrowthMissionType): MissionDefinition {
  return MISSION_DEFINITIONS[missionType]
}

export function decomposeMission(missionType: GrowthMissionType): GrowthMissionDecomposition {
  return DECOMPOSITION[missionType]
}

export function resolveMissionDependencies(missionType: GrowthMissionType): GrowthMissionDependencies {
  return {
    prerequisites: DEPENDENCY_GRAPH[missionType].prerequisites,
    blocking: DEPENDENCY_GRAPH[missionType].blocking,
    optional: DEPENDENCY_GRAPH[missionType].optional,
    parallel: DEPENDENCY_GRAPH[missionType].parallel,
  }
}

function resolvePriority(input: GrowthMissionDerivationInput, missionType: GrowthMissionType): GrowthMissionPriority {
  if (missionType === "recover_failed_workflow") return "critical"
  if (input.blockedReasons?.length) return "high"
  if (input.approvalState === "approved_for_future_execution") return "high"
  if (missionType === "monitor_account") return "low"
  return "normal"
}

function resolveEscalation(input: GrowthMissionDerivationInput, status: GrowthMissionStatus): RevenueOperatorEscalationLevel {
  if (status === "blocked") return "high"
  if (status === "waiting_for_human") return "medium"
  if (input.orchestrationDecision === "human_review_required") return "medium"
  return "none"
}

function resolveStatus(input: GrowthMissionDerivationInput, missionType: GrowthMissionType): GrowthMissionStatus {
  if (missionType === "close_opportunity" && input.workflowType === "close") return "completed"
  if (input.runtimeState === "completed" && missionType === "recover_failed_workflow") return "completed"
  if (missionType === "qualify_lead" && input.qualificationSummary) return "completed"
  if (missionType === "enrich_account" && input.researchSummary && input.workflowStatus !== "not_started") {
    return "completed"
  }
  if ((input.blockedReasons?.length ?? 0) > 0) {
    if (input.humanReviewRequirements?.length) return "waiting_for_human"
    return "blocked"
  }
  if (input.orchestrationDecision === "human_review_required") return "waiting_for_human"
  if (missionType === "prepare_outreach") return "blocked"
  if (input.approvalState === "approved_for_future_execution") return "active"
  if (input.researchSummary || input.qualificationSummary) return "planned"
  return "proposed"
}

function resolveStage(input: GrowthMissionDerivationInput, missionType: GrowthMissionType, status: GrowthMissionStatus): string {
  if (status === "completed") return "complete"
  if (status === "blocked" || status === "waiting_for_human") return "blocked"
  if (missionType === "enrich_account") {
    return input.researchSummary ? "research_synthesis" : "discovery"
  }
  if (missionType === "qualify_lead") {
    return input.qualificationSummary ? "qualification_review" : "evidence_gathering"
  }
  if (missionType === "identify_buying_committee") return "committee_mapping"
  if (missionType === "prepare_meeting") return "brief_preparation"
  if (missionType === "prepare_outreach") return "draft_planning"
  if (missionType === "recover_failed_workflow") return "failure_analysis"
  if (missionType === "close_opportunity") return "close_review"
  if (missionType === "monitor_account") return "signal_monitoring"
  return "planning"
}

function resolveProgress(status: GrowthMissionStatus, stage: string): number {
  if (status === "completed") return 1
  if (status === "abandoned") return 0
  const stageProgress: Record<string, number> = {
    discovery: 0.15,
    research_synthesis: 0.45,
    evidence_gathering: 0.35,
    qualification_review: 0.7,
    committee_mapping: 0.55,
    planning: 0.4,
    draft_planning: 0.5,
    brief_preparation: 0.6,
    failure_analysis: 0.25,
    close_review: 0.8,
    signal_monitoring: 0.5,
    blocked: 0.2,
    complete: 1,
  }
  if (status === "active") return Math.min(0.95, (stageProgress[stage] ?? 0.5) + 0.15)
  if (status === "planned") return stageProgress[stage] ?? 0.35
  if (status === "proposed") return 0.1
  return stageProgress[stage] ?? 0.3
}

export function assessMissionHealth(
  mission: Pick<GrowthMissionRecord, "currentStatus" | "blockedReasons" | "progress" | "lastUpdatedAt">,
  input: { generatedAt: string },
): GrowthMissionHealth {
  if (mission.currentStatus === "completed") {
    return { state: "completed", reasoning: "Mission completion criteria satisfied." }
  }
  if (mission.currentStatus === "blocked") {
    return {
      state: "blocked",
      reasoning: mission.blockedReasons[0] ?? "Mission blocked by guardrails.",
    }
  }
  if (mission.currentStatus === "waiting_for_human") {
    return { state: "waiting", reasoning: "Operator review required before progression." }
  }
  const updatedMs = Date.parse(mission.lastUpdatedAt)
  const generatedMs = Date.parse(input.generatedAt)
  const ageDays = Number.isFinite(updatedMs)
    ? (generatedMs - updatedMs) / (1000 * 60 * 60 * 24)
    : 0
  if (ageDays > 14 && mission.progress < 0.6) {
    return { state: "stalled", reasoning: "No meaningful progress in 14+ days." }
  }
  if (mission.progress < 0.2 && mission.currentStatus === "proposed") {
    return { state: "stalled", reasoning: "Mission proposed but not yet planned." }
  }
  return { state: "healthy", reasoning: "Mission progressing within expected bounds." }
}

export function buildMissionRecord(
  input: GrowthMissionDerivationInput,
  missionType: GrowthMissionType,
): GrowthMissionRecord {
  const definition = getMissionDefinition(missionType)
  const decomposition = decomposeMission(missionType)
  const dependencies = resolveMissionDependencies(missionType)
  const generatedAt = input.generatedAt ?? new Date(0).toISOString()
  const currentStatus = resolveStatus(input, missionType)
  const currentStage = resolveStage(input, missionType, currentStatus)
  const progress = resolveProgress(currentStatus, currentStage)
  const blockedReasons = [...(input.blockedReasons ?? [])]
  if (missionType === "prepare_outreach") {
    blockedReasons.push("Outreach missions remain recommendation-only in 4E.")
  }

  const mission: GrowthMissionRecord = {
    missionId: `growth-mission:${missionType}:${input.leadId}`,
    missionType,
    leadId: input.leadId,
    companyId: input.companyId ?? input.leadId,
    companyName: input.companyName ?? null,
    objective: definition.objective,
    priority: resolvePriority(input, missionType),
    ownerAgent: input.owningAgent || definition.defaultOwner,
    supportingAgents: decomposition.supportingAgents,
    currentStage,
    currentStatus,
    progress,
    requiredGates: definition.requiredGates,
    completionCriteria: definition.completionCriteria,
    successCriteria: definition.successCriteria,
    blockedReasons,
    escalationLevel: resolveEscalation(input, currentStatus),
    confidence: input.confidence ?? null,
    createdAt: input.lastUpdatedAt,
    lastUpdatedAt: input.lastUpdatedAt,
    decomposition,
    dependencies,
    health: { state: "healthy", reasoning: "Pending assessment." },
    nextRecommendation:
      input.revenueOperatorRecommendation ??
      `Continue ${missionType.replaceAll("_", " ")} planning — no execution in 4E.`,
  }

  mission.health = assessMissionHealth(mission, { generatedAt })
  mission.ownerAgent = decomposition.primaryAgent
  return mission
}

export function deriveMissionTypesForLead(input: GrowthMissionDerivationInput): GrowthMissionType[] {
  const types = new Set<GrowthMissionType>()

  if (!input.researchSummary || input.workflowStatus === "not_started") {
    types.add("enrich_account")
  }

  if (input.researchSummary && !input.qualificationSummary) {
    types.add("qualify_lead")
  }

  const workflow = input.workflowType as GrowthLeadResearchCanonicalWorkflowType | null
  if (workflow === "verify_email" || workflow === "buying_committee") {
    types.add("identify_buying_committee")
  }

  if (workflow === "outreach_generation" || input.outboundRecommended) {
    types.add("prepare_outreach")
  }

  if (workflow === "meeting_preparation") {
    types.add("prepare_meeting")
  }

  if (workflow === "monitoring") {
    types.add("monitor_account")
  }

  if (input.runtimeState === "failed" || input.workflowStatus === "failed") {
    types.add("recover_failed_workflow")
  }

  if (workflow === "close" || input.completenessState === "blocked") {
    types.add("close_opportunity")
  }

  if (types.size === 0) {
    types.add("qualify_lead")
  }

  return GROWTH_MISSION_TYPES.filter((type) => types.has(type))
}

export function deriveMissionsForLead(input: GrowthMissionDerivationInput): GrowthMissionRecord[] {
  return deriveMissionTypesForLead(input).map((missionType) => buildMissionRecord(input, missionType))
}

export function planMissions(missions: GrowthMissionRecord[]): GrowthMissionPlannerResult {
  const activeMissions = missions.filter((m) => m.currentStatus === "active" || m.currentStatus === "planned")
  const completedMissions = missions.filter((m) => m.currentStatus === "completed")
  const stalledMissions = missions.filter((m) => m.health.state === "stalled")
  const recommendedNewMissions = missions.filter(
    (m) => m.currentStatus === "proposed" && m.health.state !== "completed",
  )
  const recommendedRetiringMissions = missions.filter(
    (m) =>
      m.currentStatus === "completed" ||
      m.missionType === "close_opportunity" ||
      (m.missionType === "prepare_outreach" && m.currentStatus === "blocked"),
  )

  return {
    activeMissions,
    completedMissions,
    stalledMissions,
    recommendedNewMissions,
    recommendedRetiringMissions,
  }
}

export function buildMissionFrameworkReadModel(input: {
  missions: GrowthMissionRecord[]
  generatedAt: string
}): GrowthMissionFrameworkReadModel {
  const planner = planMissions(input.missions)

  return {
    qaMarker: GROWTH_MISSION_FRAMEWORK_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_MISSION_FRAMEWORK_RULE,
    schedulerActive: false,
    summary: {
      totalMissions: input.missions.length,
      active: planner.activeMissions.length,
      blocked: input.missions.filter((m) => m.currentStatus === "blocked").length,
      completed: planner.completedMissions.length,
      stalled: planner.stalledMissions.length,
      waitingForHuman: input.missions.filter((m) => m.currentStatus === "waiting_for_human").length,
    },
    planner,
    missions: input.missions,
  }
}

export function buildMissionPlanContext(
  missions: GrowthMissionRecord[],
): GrowthMissionPlanContext | null {
  if (missions.length === 0) return null

  const primary =
    missions.find((m) => m.currentStatus === "active") ??
    missions.find((m) => m.currentStatus === "blocked" || m.currentStatus === "waiting_for_human") ??
    missions[0]

  return {
    missionSummary: primary.objective,
    currentStage: primary.currentStage,
    ownerAgent: primary.ownerAgent,
    blockers: primary.blockedReasons,
    health: primary.health,
    recommendedNextMilestone: primary.nextRecommendation,
    primaryMissionType: primary.missionType,
  }
}

export function isMissionFrameworkSchedulerActive(): false {
  return isAgentSchedulerActive()
}

export function listSupportedMissionTypes(): typeof GROWTH_MISSION_TYPES {
  return GROWTH_MISSION_TYPES
}
