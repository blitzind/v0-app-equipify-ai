/** Phase GS-4D — Deterministic Agent Orchestration Engine (client-safe). */

import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import type { CampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-types"
import {
  filterGrowthAgentPlans,
  rankGrowthAgentPlans,
  rankGrowthAgentRecommendations,
  rankGrowthAgentTasks,
} from "@/lib/growth/agent-orchestration/agent-orchestration-priority"
import {
  AGENT_ORCHESTRATION_QA_MARKER,
  GROWTH_AGENT_IDS,
  GROWTH_AGENT_LABELS,
  GROWTH_AGENT_PLAN_STATUSES,
  GROWTH_AGENT_STATUS_LABELS,
  type AgentOrchestrationFilter,
  type GrowthAgent,
  type GrowthAgentDependency,
  type GrowthAgentExecutionGraph,
  type GrowthAgentId,
  type GrowthAgentOrchestrationResponse,
  type GrowthAgentPlan,
  type GrowthAgentRecommendation,
  type GrowthAgentStatus,
  type GrowthAgentTask,
  type GrowthAgentTaskSource,
} from "@/lib/growth/agent-orchestration/agent-orchestration-types"
import type { HumanIntervention } from "@/lib/growth/human-interventions/human-intervention-types"
import type { GrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-types"
import type { SmartFollowUpPolicy } from "@/lib/growth/follow-up-policies/follow-up-policy-types"
import type { OperatorInboxItem } from "@/lib/growth/operator-inbox/operator-inbox-types"
import type { SequencePreview } from "@/lib/growth/sequence-preview/sequence-preview-types"

function buildAgents(): GrowthAgent[] {
  return GROWTH_AGENT_IDS.map((agent_id) => ({
    agent_id,
    label: GROWTH_AGENT_LABELS[agent_id],
    role: "Planning coordinator — recommendations only, no autonomous execution",
    subsystem: agentIdToSource(agent_id),
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }))
}

function agentIdToSource(agentId: GrowthAgentId): GrowthAgentTaskSource {
  switch (agentId) {
    case "readiness_coordinator":
      return "campaign_readiness"
    case "sequence_planner":
      return "sequence_preview"
    case "intervention_router":
      return "human_interventions"
    case "follow_up_planner":
      return "follow_up_policies"
    case "campaign_builder_coordinator":
      return "campaign_builder"
    case "inbox_triage_coordinator":
      return "operator_inbox"
    case "event_bus_observer":
      return "realtime_events"
    default:
      return "knowledge_recommendations"
  }
}

function leadHref(leadId: string | null | undefined): string | null {
  return leadId ? `/admin/growth/command?leadId=${encodeURIComponent(leadId)}` : "/admin/growth/command"
}

function taskFromReadiness(readiness: CampaignReadinessAssessment | null | undefined, leadId: string | null): GrowthAgentTask {
  let status: GrowthAgentTask["status"] = "pending"
  let priority: GrowthAgentTask["priority"] = "medium"
  const blockers: string[] = []

  if (!readiness) {
    status = "pending"
    blockers.push("Run campaign readiness assessment")
  } else if (readiness.readiness_status === "ready") {
    status = "complete"
    priority = "low"
  } else if (readiness.readiness_status === "not_ready") {
    status = "blocked"
    priority = "urgent"
    blockers.push(...readiness.blockers.filter((b) => b.severity === "critical").map((b) => b.message))
  } else {
    status = "needs_review"
    priority = "high"
    blockers.push(...readiness.blockers.slice(0, 2).map((b) => b.message))
  }

  return {
    task_id: "task_readiness_review",
    agent_id: "readiness_coordinator",
    source: "campaign_readiness",
    label: "Review campaign readiness",
    description: readiness
      ? `Readiness ${readiness.readiness_status} (score ${readiness.readiness_score})`
      : "Assess campaign readiness before planning outreach",
    order: 1,
    status,
    priority,
    related_href: leadHref(leadId),
    blockers,
  }
}

function taskFromInterventions(interventions: HumanIntervention[], leadId: string | null): GrowthAgentTask {
  const blocked = interventions.filter(
    (i) => i.intervention_type === "campaign_blocked" || i.intervention_type === "risk_detected",
  )
  const urgent = interventions.filter((i) => i.priority === "urgent" || i.priority === "high")

  return {
    task_id: "task_intervention_triage",
    agent_id: "intervention_router",
    source: "human_interventions",
    label: "Triage human interventions",
    description: `${interventions.length} intervention(s) — operator review required`,
    order: 2,
    status: blocked.length > 0 ? "blocked" : urgent.length > 0 ? "needs_review" : interventions.length ? "ready" : "pending",
    priority: blocked.length > 0 ? "urgent" : urgent.length > 0 ? "high" : "medium",
    related_href: leadHref(leadId),
    blockers: blocked.slice(0, 3).map((i) => i.title),
  }
}

function taskFromInbox(items: OperatorInboxItem[], leadId: string | null): GrowthAgentTask {
  const urgent = items.filter((i) => i.priority === "urgent" || i.priority === "high")
  return {
    task_id: "task_inbox_triage",
    agent_id: "inbox_triage_coordinator",
    source: "operator_inbox",
    label: "Triage operator inbox",
    description: `${items.length} inbox item(s) awaiting operator review`,
    order: 3,
    status: urgent.length > 0 ? "needs_review" : items.length ? "ready" : "pending",
    priority: urgent.length > 0 ? "high" : "medium",
    related_href: leadHref(leadId),
    blockers: [],
  }
}

function taskFromSequencePreview(previews: SequencePreview[], leadId: string | null): GrowthAgentTask {
  const preview = previews[0]
  const blocked = previews.some((p) => p.sequence_status === "blocked")
  return {
    task_id: "task_sequence_preview",
    agent_id: "sequence_planner",
    source: "sequence_preview",
    label: "Review sequence preview",
    description: preview
      ? `Preview: ${preview.pattern_label} (${preview.sequence_status.replace(/_/g, " ")})`
      : "Generate sequence preview before campaign approval",
    order: 4,
    status: blocked ? "blocked" : preview?.sequence_status === "ready_for_human_approval" ? "complete" : preview ? "needs_review" : "pending",
    priority: blocked ? "high" : "medium",
    related_href: preview?.related_href ?? `/admin/growth/sequences/builder${leadId ? `?leadId=${encodeURIComponent(leadId)}` : ""}`,
    blockers: preview?.risks.filter((r) => r.severity === "critical").map((r) => r.title) ?? [],
  }
}

function taskFromFollowUpPolicies(policies: SmartFollowUpPolicy[], leadId: string | null): GrowthAgentTask {
  const urgent = policies.filter((p) => p.priority === "urgent" || p.priority === "high")
  return {
    task_id: "task_follow_up_policies",
    agent_id: "follow_up_planner",
    source: "follow_up_policies",
    label: "Align follow-up policies",
    description: `${policies.length} follow-up polic${policies.length === 1 ? "y" : "ies"} for operator planning`,
    order: 5,
    status: urgent.length > 0 ? "needs_review" : policies.length ? "ready" : "pending",
    priority: urgent.length > 0 ? "high" : "low",
    related_href: leadHref(leadId),
    blockers: [],
  }
}

function taskFromCampaignBuilder(wizards: CampaignBuilderWizard[], leadId: string | null): GrowthAgentTask {
  const wizard = wizards[0]
  return {
    task_id: "task_campaign_builder",
    agent_id: "campaign_builder_coordinator",
    source: "campaign_builder",
    label: "Complete campaign builder wizard",
    description: wizard
      ? `Wizard: ${wizard.configuration.suggested_pattern_label ?? "configuration"} (score ${wizard.configuration_score})`
      : "Run campaign builder wizard for coordinated planning",
    order: 6,
    status:
      wizard?.wizard_status === "blocked"
        ? "blocked"
        : wizard?.wizard_status === "ready_for_human_approval"
          ? "complete"
          : wizard
            ? "needs_review"
            : "pending",
    priority: wizard?.wizard_status === "blocked" ? "high" : "medium",
    related_href: wizard?.related_href ?? leadHref(leadId),
    blockers: wizard?.risks.filter((r) => r.severity === "critical").map((r) => r.title) ?? [],
  }
}

function taskFromRealtimeEvents(events: GrowthRealtimeEvent[], leadId: string | null): GrowthAgentTask {
  const pending = events.filter((e) => e.delivery_status === "pending")
  return {
    task_id: "task_realtime_events",
    agent_id: "event_bus_observer",
    source: "realtime_events",
    label: "Review realtime event bus",
    description: `${events.length} recent event(s) — UI refresh signals only`,
    order: 7,
    status: pending.length > 0 ? "needs_review" : events.length ? "ready" : "pending",
    priority: pending.length > 0 ? "medium" : "low",
    related_href: leadHref(leadId),
    blockers: [],
  }
}

function taskFromSequenceIntelligence(patternCount: number, leadId: string | null): GrowthAgentTask {
  return {
    task_id: "task_sequence_intelligence",
    agent_id: "sequence_planner",
    source: "sequence_intelligence",
    label: "Review sequence intelligence",
    description: `${patternCount} active sequence pattern(s) available for planning`,
    order: 8,
    status: patternCount > 0 ? "ready" : "pending",
    priority: "low",
    related_href: `/admin/growth/sequences/builder${leadId ? `?leadId=${encodeURIComponent(leadId)}` : ""}`,
    blockers: patternCount === 0 ? ["No sequence patterns configured"] : [],
  }
}

function taskFromKnowledge(leadId: string | null): GrowthAgentTask {
  return {
    task_id: "task_knowledge_review",
    agent_id: "readiness_coordinator",
    source: "knowledge_recommendations",
    label: "Review knowledge recommendations",
    description: "Confirm playbook and knowledge citations before messaging planning",
    order: 9,
    status: "pending",
    priority: "medium",
    related_href: `/admin/growth/knowledge${leadId ? `?leadId=${encodeURIComponent(leadId)}` : ""}`,
    blockers: [],
  }
}

/**
 * Route a task to its coordinating agent — deterministic, no execution.
 */
export function routeGrowthAgentTask(task: GrowthAgentTask): GrowthAgent {
  return {
    agent_id: task.agent_id,
    label: GROWTH_AGENT_LABELS[task.agent_id],
    role: `Coordinates ${task.source.replace(/_/g, " ")} — planning only`,
    subsystem: task.source,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

/**
 * Resolve task dependency graph deterministically.
 */
export function resolveGrowthAgentDependencies(tasks: GrowthAgentTask[]): GrowthAgentDependency[] {
  const byId = new Map(tasks.map((t) => [t.task_id, t]))
  const deps: GrowthAgentDependency[] = []

  const pairs: Array<[string, string, GrowthAgentDependency["dependency_type"], string]> = [
    ["task_readiness_review", "task_sequence_preview", "blocks", "Readiness must be reviewed before sequence preview approval"],
    ["task_readiness_review", "task_campaign_builder", "blocks", "Campaign builder depends on readiness context"],
    ["task_intervention_triage", "task_campaign_builder", "blocks", "Resolve blocking interventions before campaign planning"],
    ["task_intervention_triage", "task_follow_up_policies", "informs", "Interventions inform follow-up policy alignment"],
    ["task_inbox_triage", "task_intervention_triage", "informs", "Inbox items may surface interventions"],
    ["task_sequence_preview", "task_follow_up_policies", "informs", "Sequence timing informs follow-up windows"],
    ["task_sequence_preview", "task_sequence_intelligence", "optional", "Sequence intelligence supports preview validation"],
    ["task_realtime_events", "task_inbox_triage", "informs", "Event bus signals may refresh inbox context"],
    ["task_knowledge_review", "task_sequence_preview", "informs", "Knowledge assets support sequence messaging"],
  ]

  for (const [from, to, type, rationale] of pairs) {
    if (!byId.has(from) || !byId.has(to)) continue
    deps.push({
      dependency_id: `dep_${from}_${to}`,
      from_task_id: from,
      to_task_id: to,
      dependency_type: type,
      rationale,
    })
  }

  return deps
}

function buildExecutionGraph(tasks: GrowthAgentTask[], dependencies: GrowthAgentDependency[]): GrowthAgentExecutionGraph {
  const ordered = rankGrowthAgentTasks(tasks)
  return {
    graph_id: `graph_${ordered.map((t) => t.task_id).join("_").slice(0, 48)}`,
    nodes: ordered.map((task, index) => ({
      node_id: `node_${task.task_id}`,
      task_id: task.task_id,
      label: task.label,
      order: index + 1,
    })),
    edges: dependencies.map((dep) => ({
      edge_id: dep.dependency_id,
      from_task_id: dep.from_task_id,
      to_task_id: dep.to_task_id,
      label: dep.dependency_type,
    })),
  }
}

function buildRecommendations(plan: Pick<GrowthAgentPlan, "plan_id" | "related_href" | "plan_status">, tasks: GrowthAgentTask[]): GrowthAgentRecommendation[] {
  const recs: GrowthAgentRecommendation[] = tasks
    .filter((t) => t.status === "blocked" || t.status === "needs_review")
    .slice(0, 5)
    .map((task) => ({
      recommendation_id: `rec_${task.task_id}`,
      title: `Review: ${task.label}`,
      description: task.description,
      priority: task.priority === "urgent" || task.priority === "high" ? "high" : "medium",
      source: task.source,
      related_href: task.related_href,
      action_type: "open_related" as const,
    }))

  recs.push({
    recommendation_id: `rec_review_${plan.plan_id}`,
    title: "Mark orchestration plan reviewed",
    description: `Confirm operator reviewed ${GROWTH_AGENT_STATUS_LABELS[plan.plan_status].toLowerCase()} plan — no autonomous execution.`,
    priority: "high",
    source: "campaign_builder",
    related_href: plan.related_href,
    action_type: "mark_reviewed",
  })

  return rankGrowthAgentRecommendations(recs)
}

function buildRisks(tasks: GrowthAgentTask[], interventions: HumanIntervention[]): GrowthAgentPlan["risks"] {
  const risks: GrowthAgentPlan["risks"] = [
    {
      risk_id: "risk_orchestration_only",
      severity: "medium",
      title: "Orchestration and planning only",
      description: "Agent plan coordinates recommendations — never executes outreach, enrollment, or autonomous actions.",
    },
  ]

  for (const task of tasks.filter((t) => t.status === "blocked")) {
    risks.push({
      risk_id: `risk_task_${task.task_id}`,
      severity: "critical",
      title: `Blocked: ${task.label}`,
      description: task.blockers.join(" · ") || task.description,
    })
  }

  for (const intervention of interventions.filter((i) => i.intervention_type === "risk_detected").slice(0, 2)) {
    risks.push({
      risk_id: `risk_intervention_${intervention.intervention_id}`,
      severity: "high",
      title: intervention.title,
      description: intervention.description,
    })
  }

  return risks.slice(0, 10)
}

function resolvePlanStatus(tasks: GrowthAgentTask[], risks: GrowthAgentPlan["risks"]): GrowthAgentStatus {
  if (tasks.length === 0) return "draft"
  if (risks.some((r) => r.severity === "critical") || tasks.some((t) => t.status === "blocked")) return "blocked"
  if (tasks.some((t) => t.status === "needs_review")) return "needs_review"
  if (tasks.filter((t) => t.status === "complete" || t.status === "ready").length >= 5) {
    return "ready_for_human_approval"
  }
  return "needs_review"
}

function computePlanScore(tasks: GrowthAgentTask[]): number {
  let score = 40
  score += tasks.filter((t) => t.status === "complete").length * 10
  score += tasks.filter((t) => t.status === "ready").length * 6
  score -= tasks.filter((t) => t.status === "blocked").length * 15
  score -= tasks.filter((t) => t.status === "needs_review").length * 4
  return Math.max(0, Math.min(100, score))
}

function countByStatus(plans: GrowthAgentPlan[]): Record<GrowthAgentStatus, number> {
  const counts = Object.fromEntries(GROWTH_AGENT_PLAN_STATUSES.map((s) => [s, 0])) as Record<
    GrowthAgentStatus,
    number
  >
  for (const plan of plans) counts[plan.plan_status] += 1
  return counts
}

export type GrowthAgentPlanInput = {
  lead_id?: string | null
  company_name?: string | null
  campaign_readiness?: CampaignReadinessAssessment | null
  sequence_previews?: SequencePreview[]
  follow_up_policies?: SmartFollowUpPolicy[]
  interventions?: HumanIntervention[]
  campaign_wizards?: CampaignBuilderWizard[]
  inbox_items?: OperatorInboxItem[]
  realtime_events?: GrowthRealtimeEvent[]
  sequence_pattern_count?: number
  filter?: AgentOrchestrationFilter
  limit?: number
}

/**
 * Deterministic agent orchestration plan — coordination only, no execution.
 */
export function generateGrowthAgentPlan(input: GrowthAgentPlanInput): GrowthAgentOrchestrationResponse {
  const leadId = input.lead_id ?? null
  const tasks = [
    taskFromReadiness(input.campaign_readiness, leadId),
    taskFromInterventions(input.interventions ?? [], leadId),
    taskFromInbox(input.inbox_items ?? [], leadId),
    taskFromSequencePreview(input.sequence_previews ?? [], leadId),
    taskFromFollowUpPolicies(input.follow_up_policies ?? [], leadId),
    taskFromCampaignBuilder(input.campaign_wizards ?? [], leadId),
    taskFromRealtimeEvents(input.realtime_events ?? [], leadId),
    taskFromSequenceIntelligence(input.sequence_pattern_count ?? 0, leadId),
    taskFromKnowledge(leadId),
  ]

  const dependencies = resolveGrowthAgentDependencies(tasks)
  const execution_graph = buildExecutionGraph(tasks, dependencies)
  const risks = buildRisks(tasks, input.interventions ?? [])
  const plan_status = resolvePlanStatus(tasks, risks)
  const plan_score = computePlanScore(tasks)
  const suggested_order = rankGrowthAgentTasks(tasks).map((t) => t.task_id)

  const plan: GrowthAgentPlan = {
    qa_marker: AGENT_ORCHESTRATION_QA_MARKER,
    plan_id: `plan:${leadId ?? "global"}:${Date.now()}`,
    plan_status,
    plan_score,
    lead_id: leadId,
    company_name: input.company_name ?? null,
    agents: buildAgents(),
    tasks,
    recommendations: [],
    dependencies,
    execution_graph,
    risks,
    required_approvals: [
      "Human operator review before any campaign action",
      "No autonomous outreach or enrollment from orchestration plan",
      ...(input.campaign_readiness?.required_approvals ?? []).slice(0, 3),
    ],
    suggested_order,
    review_status: "pending",
    related_href: leadHref(leadId),
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    generated_at: new Date().toISOString(),
  }

  plan.recommendations = buildRecommendations(plan, tasks)

  const plans = filterGrowthAgentPlans([plan], input.filter ?? "all")
  const ranked = rankGrowthAgentPlans(plans)

  return {
    qa_marker: AGENT_ORCHESTRATION_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: ranked.length,
    blocked_count: ranked.filter((p) => p.plan_status === "blocked").length,
    needs_review_count: ranked.filter((p) => p.plan_status === "needs_review").length,
    ready_count: ranked.filter((p) => p.plan_status === "ready_for_human_approval").length,
    status_counts: countByStatus(ranked),
    plans: ranked.slice(0, input.limit ?? 5),
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}
