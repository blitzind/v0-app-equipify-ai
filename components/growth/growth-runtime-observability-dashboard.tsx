"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ObservabilityResponse = {
  ok: boolean
  status: "READY" | "WARN" | "MISSING"
  snapshot: {
    status: "READY" | "WARN" | "MISSING"
    missingResources: string[]
    partialResources: string[]
    budgets: {
      organizationId: string
      budgets: Array<{
        resourceType: string
        windowKind: string
        count: number
        cap: number
        remaining: number
      }>
    } | null
    userBudgets: Array<{
      resourceType: string
      windowKind: string
      count: number
      cap: number
      remaining: number
    }> | null
    killSwitches: Record<string, boolean>
    queues: {
      wakeBacklog: number
      liveWakeCount: number | null
      retention: {
        retentionRowsPending: number
        retentionBatchesRemaining: number
        lastRetentionRunAt: string | null
        lastRetentionDurationMs: number | null
        lastRetentionDeletedRows: number
      }
      retentionPolicies: Array<{ eventFamily: string; retentionDays: number; enabled: boolean }>
      rollupRebuildAvailable: boolean
    }
    health: {
      runtimeReadsEstimate: number
      runtimeWritesEstimate: number
      runtimeThrottleCount: number
      runtimeFailureCount: number
      lastFailureAt: string | null
      lastFailureMessage: string | null
      recentThrottles: Array<{ resourceType: string; message: string; severity: string; createdAt: string }>
      wakeBatch: { processedCount: number; remainingCount: number; wakeCursor: string | null }
      timeoutWakeBatch: { processedCount: number; remainingCount: number; wakeCursor: string | null }
    }
  }
}

function statusVariant(status: ObservabilityResponse["status"]): "secondary" | "destructive" | "outline" {
  if (status === "READY") return "secondary"
  if (status === "WARN") return "outline"
  return "destructive"
}

export function GrowthRuntimeObservabilityDashboard() {
  const [data, setData] = useState<ObservabilityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/runtime/observability", { cache: "no-store" })
      const json = (await response.json()) as ObservabilityResponse & { error?: string }
      if (!response.ok && response.status !== 200) {
        throw new Error(json.error ?? "Failed to load runtime observability.")
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runtime observability.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading runtime guardrails…</p>
  }

  if (error && !data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  const snapshot = data?.snapshot
  if (!snapshot) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Read-only observability</p>
          <Badge variant={statusVariant(snapshot.status)}>{snapshot.status}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {(snapshot.missingResources.length > 0 || snapshot.partialResources.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schema status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {snapshot.missingResources.map((resource) => (
              <p key={resource} className="text-destructive">
                Missing: {resource}
              </p>
            ))}
            {snapshot.partialResources.map((resource) => (
              <p key={resource} className="text-muted-foreground">
                Partial: {resource}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Runtime health (estimates)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between">
            <span>Reads (est.)</span>
            <span>{snapshot.health.runtimeReadsEstimate}</span>
          </div>
          <div className="flex justify-between">
            <span>Writes (est.)</span>
            <span>{snapshot.health.runtimeWritesEstimate}</span>
          </div>
          <div className="flex justify-between">
            <span>Throttles</span>
            <span>{snapshot.health.runtimeThrottleCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Failures</span>
            <span>{snapshot.health.runtimeFailureCount}</span>
          </div>
          {snapshot.health.lastFailureAt ? (
            <p className="col-span-2 text-xs text-muted-foreground">
              Last failure: {snapshot.health.lastFailureAt} — {snapshot.health.lastFailureMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kill switches</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(snapshot.killSwitches).map(([key, enabled]) => (
            <Badge key={key} variant={enabled ? "secondary" : "destructive"}>
              {key}: {enabled ? "enabled" : "disabled"}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Org budgets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(snapshot.budgets?.budgets ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No org budgets loaded (configure GROWTH_ENGINE_AI_ORG_ID or apply migration).
            </p>
          ) : (
            snapshot.budgets?.budgets.map((budget) => (
              <div key={`org-${budget.resourceType}-${budget.windowKind}`} className="flex justify-between text-sm">
                <span>
                  {budget.resourceType} ({budget.windowKind})
                </span>
                <span>
                  {budget.count}/{budget.cap} · {budget.remaining} remaining
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User budgets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(snapshot.userBudgets ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">User budgets unavailable or GS-RG-1C not applied.</p>
          ) : (
            snapshot.userBudgets?.map((budget) => (
              <div key={`user-${budget.resourceType}-${budget.windowKind}`} className="flex justify-between text-sm">
                <span>
                  {budget.resourceType} ({budget.windowKind})
                </span>
                <span>
                  {budget.count}/{budget.cap} · {budget.remaining} remaining
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Wake backlog</span>
            <span>{snapshot.queues.wakeBacklog}</span>
          </div>
          {snapshot.queues.liveWakeCount != null ? (
            <div className="flex justify-between text-muted-foreground">
              <span>Live active waits</span>
              <span>{snapshot.queues.liveWakeCount}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>Retention rows pending</span>
            <span>{snapshot.queues.retention.retentionRowsPending}</span>
          </div>
          <div className="flex justify-between">
            <span>Retention batches remaining</span>
            <span>{snapshot.queues.retention.retentionBatchesRemaining}</span>
          </div>
          <div className="flex justify-between">
            <span>Last retention run</span>
            <span>{snapshot.queues.retention.lastRetentionRunAt ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Last retention duration</span>
            <span>
              {snapshot.queues.retention.lastRetentionDurationMs != null
                ? `${snapshot.queues.retention.lastRetentionDurationMs}ms`
                : "—"}
            </span>
          </div>
          <div className="pt-2">
            <p className="mb-1 font-medium">Retention policies</p>
            {snapshot.queues.retentionPolicies.map((policy) => (
              <div key={policy.eventFamily} className="flex justify-between text-muted-foreground">
                <span>{policy.eventFamily}</span>
                <span>
                  {policy.retentionDays}d raw · {policy.enabled ? "active" : "paused"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent throttles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {snapshot.health.recentThrottles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent guardrail warnings.</p>
          ) : (
            snapshot.health.recentThrottles.map((entry, index) => (
              <div key={`${entry.createdAt}-${index}`} className="rounded-md border p-2 text-sm">
                <div className="flex justify-between gap-2">
                  <Badge variant="outline">{entry.resourceType}</Badge>
                  <span className="text-xs text-muted-foreground">{entry.createdAt}</span>
                </div>
                <p className="mt-1">{entry.message}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
