"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Activity, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { blitzpayWorkflowExecutionPillClass, formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-formatters"

const DISCLAIMER =
  "Observability and replay tooling support operational visibility and controlled recovery workflows. Financial actions remain subject to validation and approval safeguards."

type Phase6b = {
  queueHealthScore: number
  workflowFailureRate: number
  idempotencyConflictRate: number
  replayPendingCount: number
  observabilityCoverageRate: number
  workerHealthScore: number
  multiRegionReadinessScore: number
  replayIntegrityScore: number
}

type HealthPayload = {
  disclaimer: string
  phase6b: Phase6b
  summary: { overallScore: number; backpressure: boolean }
  auditTail: Array<{ id: string; audit_type: string; audit_summary: string; created_at: string }>
  replayAuthorized: boolean
}

type WorkflowRow = {
  id: string
  workflow_type: string
  execution_status: string
  execution_summary: string | null
  last_error: string | null
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayEnterpriseObservabilityPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [replayBusyId, setReplayBusyId] = useState<string | null>(null)
  const [replayMsg, setReplayMsg] = useState<string | null>(null)

  const base = useCallback(() => {
    if (!organizationId) return ""
    return `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/observability`
  }, [organizationId])

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setHealth(null)
      setWorkflows([])
      return
    }
    setLoading(true)
    setError(null)
    const b = base()
    try {
      const [hRes, wRes] = await Promise.all([
        fetch(`${b}/health`, { cache: "no-store", credentials: "include" }),
        fetch(`${b}/workflows`, { cache: "no-store", credentials: "include" }),
      ])
      if (!hRes.ok) {
        const j = (await hRes.json().catch(() => ({}))) as { message?: string }
        throw new Error(j.message ?? `Health ${hRes.status}`)
      }
      if (!wRes.ok) {
        const j = (await wRes.json().catch(() => ({}))) as { message?: string }
        throw new Error(j.message ?? `Workflows ${wRes.status}`)
      }
      const h = (await hRes.json()) as HealthPayload
      const wj = (await wRes.json()) as { items?: WorkflowRow[] }
      setHealth(h)
      setWorkflows(wj.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed")
      setHealth(null)
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }, [base, organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  async function markReplay(workflowId: string) {
    if (!organizationId) return
    setReplayBusyId(workflowId)
    setReplayMsg(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/observability/workflows/${encodeURIComponent(workflowId)}/replay`,
        { method: "POST", credentials: "include" },
      )
      const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!res.ok) {
        setReplayMsg(j.message ?? j.error ?? `Request failed (${res.status})`)
        return
      }
      setReplayMsg("Replay visibility recorded. Follow your standard approval workflow for any money movement.")
      await load()
    } catch (e) {
      setReplayMsg(e instanceof Error ? e.message : "Replay request failed")
    } finally {
      setReplayBusyId(null)
    }
  }

  const p6 = health?.phase6b

  return (
    <div
      id="blitzpay-enterprise-observability-anchor"
      className="rounded-xl border border-border bg-card text-card-foreground shadow-sm min-w-0 max-w-full overflow-x-hidden"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Enterprise observability</p>
            <p className="text-xs text-muted-foreground leading-snug">
              Queue visibility, workflow status, and controlled replay markers — metrics only.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading || !orgReady} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {!organizationId || !orgReady ? (
          <p className="text-sm text-muted-foreground">{blitzpayStaffWidgetLoadCopy.orgNotReady}</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !health ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading observability…
          </div>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground leading-relaxed border border-border/60 rounded-lg px-3 py-2 bg-muted/20">
              {DISCLAIMER}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm min-w-0">
              <Score label="Queue health" value={p6?.queueHealthScore ?? 0} warn={(p6?.queueHealthScore ?? 100) < 60} />
              <Score label="Worker health" value={p6?.workerHealthScore ?? 0} warn={(p6?.workerHealthScore ?? 100) < 60} />
              <Score label="Workflow failures %" value={p6?.workflowFailureRate ?? 0} warn={(p6?.workflowFailureRate ?? 0) > 25} suffix="%" />
              <Score label="Idempotency conflicts %" value={p6?.idempotencyConflictRate ?? 0} warn={(p6?.idempotencyConflictRate ?? 0) > 15} suffix="%" />
              <Score label="Replay backlog" value={p6?.replayPendingCount ?? 0} warn={(p6?.replayPendingCount ?? 0) >= 8} />
              <Score label="Event hash coverage %" value={p6?.observabilityCoverageRate ?? 0} warn={(p6?.observabilityCoverageRate ?? 100) < 50} suffix="%" />
              <Score label="Multi-region readiness" value={p6?.multiRegionReadinessScore ?? 0} warn={(p6?.multiRegionReadinessScore ?? 100) < 60} />
              <Score label="Replay integrity %" value={p6?.replayIntegrityScore ?? 0} warn={false} suffix="%" />
            </div>

            <div className="rounded-lg border border-border/70 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Overall observability comfort</span>
              <span className="font-semibold tabular-nums">{health.summary.overallScore}/100</span>
              {health.summary.backpressure ? (
                <span className="text-[color:var(--status-warning)] font-medium">Backpressure watch</span>
              ) : (
                <span className="text-muted-foreground">No backpressure flag</span>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent workflows (sample)</p>
              {workflows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No workflow executions in the recent bounded window — new rows appear as BlitzPay jobs run for this org.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {workflows.slice(0, 12).map((w) => (
                    <li
                      key={w.id}
                      className="rounded-md border border-border/60 px-3 py-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <p className="font-medium text-foreground break-words">{formatBlitzpayUiLabel(w.workflow_type)}</p>
                        <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 min-w-0">
                          <span className={blitzpayWorkflowExecutionPillClass(w.execution_status)}>
                            {formatBlitzpayUiLabel(w.execution_status)}
                          </span>
                          {w.last_error ? (
                            <span className="break-words text-muted-foreground">— {w.last_error.slice(0, 160)}</span>
                          ) : null}
                        </p>
                      </div>
                      {w.execution_status === "failed" && health.replayAuthorized ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={replayBusyId === w.id}
                          onClick={() => void markReplay(w.id)}
                        >
                          {replayBusyId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Mark replayed"}
                        </Button>
                      ) : w.execution_status === "failed" && !health.replayAuthorized ? (
                        <span className="text-[11px] text-muted-foreground">Owner / admin</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {replayMsg ? <p className="text-xs text-muted-foreground">{replayMsg}</p> : null}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audit tail (sample)</p>
              {health.auditTail.length === 0 ? (
                <p className="text-sm text-muted-foreground">No observability audit rows yet.</p>
              ) : (
                <ul className="text-xs space-y-1 text-muted-foreground">
                  {health.auditTail.slice(0, 8).map((a) => (
                    <li key={a.id} className="break-words min-w-0">
                      <span className="font-medium text-foreground">{formatBlitzpayUiLabel(a.audit_type)}</span> —{" "}
                      {a.audit_summary}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Deeper lists live under{" "}
              <Link href="/insights/financial-command-center#blitzpay-enterprise-observability-anchor" className="text-primary underline-offset-2 hover:underline">
                Financial Command Center
              </Link>{" "}
              and staff APIs (bounded reads).
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Score(props: { label: string; value: number; warn: boolean; suffix?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        props.warn ? "border-[color:var(--status-warning)]/50 bg-[color:var(--status-warning)]/5" : "border-border/70 bg-background/40",
      )}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wide leading-snug">{props.label}</p>
      <p className="text-base font-semibold tabular-nums mt-1 text-foreground">
        {props.value}
        {props.suffix ?? ""}
      </p>
    </div>
  )
}
