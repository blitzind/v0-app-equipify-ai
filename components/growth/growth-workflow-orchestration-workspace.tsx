"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, GitBranch, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { VoiceWorkflowOrchestrationWorkspaceSnapshot } from "@/lib/voice/workflow-orchestration/types"
import { VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER } from "@/lib/voice/workflow-orchestration/types"

export function GrowthWorkflowOrchestrationWorkspace() {
  const [workspace, setWorkspace] = useState<VoiceWorkflowOrchestrationWorkspaceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/voice/workflow-orchestration/workspace", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        workspace?: VoiceWorkflowOrchestrationWorkspaceSnapshot
        message?: string
      }
      if (!res.ok || !data.workspace) {
        throw new Error(data.message ?? "Could not load workflow orchestration workspace.")
      }
      setWorkspace(data.workspace)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !workspace) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading workflow orchestration…
      </div>
    )
  }

  if (error && !workspace) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!workspace) return null

  const { health, activeOrchestrations, stalledOrchestrations, recentEvents, routingRecommendations } = workspace

  return (
    <div className="space-y-6" data-voice-workflow-orchestration-qa-marker={VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge label="Operator-controlled" tone="neutral" />
          <GrowthBadge label="No autonomous execution" tone="neutral" />
          {health.stalledCount > 0 ? (
            <GrowthBadge label={`${health.stalledCount} stalled`} tone="attention" />
          ) : (
            <GrowthBadge label="No stalled workflows" tone="healthy" />
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{workspace.message}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active orchestrations" value={String(activeOrchestrations.length)} />
        <StatTile label="Stalled" value={String(health.stalledCount)} />
        <StatTile label="Escalated" value={String(health.unresolvedEscalationCount)} />
        <StatTile label="Compliance holds" value={String(health.complianceHoldCount)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Active orchestrations" icon={<GitBranch className="size-4" />}>
          {activeOrchestrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active orchestrations.</p>
          ) : (
            <ul className="space-y-3">
              {activeOrchestrations.slice(0, 8).map((o) => (
                <li key={o.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge label={o.orchestrationStatus.replace(/_/g, " ")} tone="neutral" />
                    <span className="font-medium">{o.orchestrationType.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{o.orchestrationSummary}</p>
                  {o.nextRecommendedAction ? (
                    <p className="mt-1 text-xs">Next: {o.nextRecommendedAction}</p>
                  ) : null}
                  {o.blockedReason ? (
                    <p className="mt-1 text-xs text-amber-700">Blocked: {o.blockedReason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Stalled workflows" icon={<AlertTriangle className="size-4" />}>
          {stalledOrchestrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stalled workflows detected.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stalledOrchestrations.slice(0, 6).map((o) => (
                <li key={o.id} className="rounded-md border border-amber-200/60 bg-amber-50/30 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <span className="font-medium">{o.orchestrationType.replace(/_/g, " ")}</span>
                  <p className="text-xs text-muted-foreground">Updated {new Date(o.updatedAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>

      {routingRecommendations.length > 0 ? (
        <GrowthEngineCard title="Routing recommendations (visibility only)" icon={<GitBranch className="size-4" />}>
          <ul className="space-y-2 text-sm">
            {routingRecommendations.map((r, i) => (
              <li key={`${r.operatorId ?? "none"}-${i}`} className="text-muted-foreground">
                <span className="font-medium text-foreground">{r.operatorLabel}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      {recentEvents.length > 0 ? (
        <GrowthEngineCard title="Recent timeline events" icon={<GitBranch className="size-4" />}>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {recentEvents.slice(0, 10).map((e) => (
              <li key={e.id}>
                <span className="font-medium text-foreground">{e.eventType.replace(/_/g, " ")}</span> — {e.evidenceText}
                <span className="ml-2 opacity-70">{new Date(e.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      {health.escalationHotspots.length > 0 ? (
        <div className="text-xs text-muted-foreground">
          Escalation hotspots:{" "}
          {health.escalationHotspots.map((h) => `${h.type.replace(/_/g, " ")} (${h.count})`).join(", ")}
        </div>
      ) : null}
    </div>
  )
}
