"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bot, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import {
  AGENT_ORCHESTRATION_FILTERS,
  AGENT_ORCHESTRATION_QA_MARKER,
  GROWTH_AGENT_STATUS_LABELS,
  type AgentOrchestrationFilter,
  type GrowthAgentOrchestrationResponse,
  type GrowthAgentPlan,
  type GrowthAgentTask,
} from "@/lib/growth/agent-orchestration/agent-orchestration-types"
import { useGrowthRealtimeRefresh } from "@/lib/growth/realtime-events/use-growth-realtime-refresh"
import { withGrowthFeatureShellGate } from "@/components/growth/runtime/with-growth-feature-shell-gate"
import { fetchPlatformGrowthClient } from "@/lib/growth/platform-growth-client-fetch"

function statusTone(status: GrowthAgentPlan["plan_status"]) {
  switch (status) {
    case "blocked":
      return "critical" as const
    case "needs_review":
      return "attention" as const
    case "ready_for_human_approval":
      return "healthy" as const
    default:
      return "neutral" as const
  }
}

function taskTone(status: GrowthAgentTask["status"]) {
  switch (status) {
    case "blocked":
      return "critical" as const
    case "needs_review":
      return "attention" as const
    case "complete":
    case "ready":
      return "healthy" as const
    default:
      return "neutral" as const
  }
}

function GrowthAgentOrchestrationPanelInner({
  title = "Agent Orchestration",
  leadId,
  patternId,
  compact = false,
  useInboxConcurrencyLimit = false,
  enableRealtimeRefresh = true,
  loadOnMount = true,
}: {
  title?: string
  leadId?: string | null
  patternId?: string | null
  compact?: boolean
  useInboxConcurrencyLimit?: boolean
  enableRealtimeRefresh?: boolean
  loadOnMount?: boolean
}) {
  const [filter, setFilter] = useState<AgentOrchestrationFilter>("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [orchestration, setOrchestration] = useState<GrowthAgentOrchestrationResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (leadId) params.set("lead_id", leadId)
      if (patternId) params.set("pattern_id", patternId)
      params.set("filter", filter)
      params.set("limit", compact ? "3" : "10")

      const res = await fetchPlatformGrowthClient(`/api/platform/growth/agent-orchestration?${params.toString()}`, {
        useInboxConcurrencyLimit,
      })
      const data = (await res.json()) as GrowthAgentOrchestrationResponse & { ok?: boolean }
      if (!res.ok) {
        setError("Agent orchestration request failed")
        setOrchestration(null)
        return
      }
      setOrchestration(data)
    } catch {
      setError("Agent orchestration unavailable")
      setOrchestration(null)
    } finally {
      setLoading(false)
    }
  }, [compact, filter, leadId, patternId, useInboxConcurrencyLimit])

  useEffect(() => {
    if (!loadOnMount) return
    void load()
  }, [load, loadOnMount])

  useGrowthRealtimeRefresh({
    subscriber: "agent_orchestration",
    onRefresh: () => void load(),
    enabled: enableRealtimeRefresh,
  })

  async function runAction(plan: GrowthAgentPlan, action: "mark_reviewed" | "dismiss") {
    setActingId(plan.plan_id)
    try {
      await fetch("/api/platform/growth/agent-orchestration/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, plan }),
      })
      await load()
    } finally {
      setActingId(null)
    }
  }

  async function viewPlan(plan: GrowthAgentPlan) {
    setExpandedId(plan.plan_id)
    await fetch("/api/platform/growth/agent-orchestration/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view_details", plan }),
    }).catch(() => null)
  }

  return (
    <GrowthEngineCard
      title={title}
      icon={<Bot className="h-4 w-4" />}
      data-qa-marker={AGENT_ORCHESTRATION_QA_MARKER}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Coordinates readiness, inbox, sequences, policies, interventions, and event bus into a deterministic
        planning graph. Recommendations only — no send, launch, enroll, or autonomous execution.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {AGENT_ORCHESTRATION_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              filter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {value.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
        {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
        Refresh plan
      </Button>

      {orchestration ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <GrowthBadge tone="neutral">{orchestration.total} plans</GrowthBadge>
          <GrowthBadge tone="critical">{orchestration.blocked_count} blocked</GrowthBadge>
          <GrowthBadge tone="attention">{orchestration.needs_review_count} needs review</GrowthBadge>
          <GrowthBadge tone="healthy">{orchestration.ready_count} ready</GrowthBadge>
        </div>
      ) : null}

      <GrowthEnginePanelResilience
        loading={loading && !orchestration}
        error={error}
        isEmpty={!loading && (orchestration?.plans.length ?? 0) === 0}
        emptyKind="no_agent_plans"
        onRetry={() => void load()}
        partialData={Boolean(orchestration)}
      >
        {orchestration?.plans.map((plan) => (
          <div key={plan.plan_id} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {plan.company_name ?? "Growth orchestration plan"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {GROWTH_AGENT_STATUS_LABELS[plan.plan_status]}
                  {plan.lead_id ? ` · Lead ${plan.lead_id.slice(0, 8)}…` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <GrowthBadge tone={statusTone(plan.plan_status)}>
                  {plan.plan_status.replace(/_/g, " ")}
                </GrowthBadge>
                <GrowthBadge tone="neutral">Score {plan.plan_score}</GrowthBadge>
                <GrowthBadge tone="neutral">{plan.review_status}</GrowthBadge>
              </div>
            </div>

            {expandedId === plan.plan_id ? (
              <div className="mb-3 space-y-3">
                <div>
                  <p className="text-xs font-medium">Recommended task graph</p>
                  <div className="mt-1 space-y-1">
                    {plan.execution_graph.nodes.map((node) => {
                      const task = plan.tasks.find((t) => t.task_id === node.task_id)
                      return (
                        <div key={node.node_id} className="flex flex-wrap items-center gap-2 text-xs">
                          <GrowthBadge tone="neutral">#{node.order}</GrowthBadge>
                          {task ? <GrowthBadge tone={taskTone(task.status)}>{task.status}</GrowthBadge> : null}
                          <span className="font-medium">{node.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {!compact ? (
                  <>
                    <div>
                      <p className="text-xs font-medium">Dependencies</p>
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {plan.dependencies.map((dep) => (
                          <li key={dep.dependency_id}>
                            {dep.from_task_id} → {dep.to_task_id} ({dep.dependency_type}): {dep.rationale}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Suggested order</p>
                      <p className="text-xs text-muted-foreground">{plan.suggested_order.join(" → ")}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium">Recommendations</p>
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {plan.recommendations.map((rec) => (
                          <li key={rec.recommendation_id}>
                            [{rec.priority}] {rec.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}

                {plan.risks.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium">Risks</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {plan.risks.map((risk) => (
                        <li key={risk.risk_id}>
                          [{risk.severity}] {risk.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {plan.required_approvals.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium">Required approvals</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">
                      {plan.required_approvals.map((approval) => (
                        <li key={approval}>{approval}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void viewPlan(plan)}>
                View Plan
              </Button>
              {plan.related_href ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={plan.related_href}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open Related Item
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="secondary"
                disabled={actingId === plan.plan_id}
                onClick={() => void runAction(plan, "mark_reviewed")}
              >
                Mark Reviewed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actingId === plan.plan_id}
                onClick={() => void runAction(plan, "dismiss")}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </GrowthEnginePanelResilience>
    </GrowthEngineCard>
  )
}

export const GrowthAgentOrchestrationPanel = withGrowthFeatureShellGate(
  "agentOrchestrationDashboard",
  GrowthAgentOrchestrationPanelInner,
  "GrowthAgentOrchestrationPanel",
)
