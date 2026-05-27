"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  deliverabilityOpsStatusLabel,
  deliverabilityRecommendationTypeLabel,
  deliverabilityRiskTypeLabel,
  deliverabilitySeverityLabel,
  GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE,
  GROWTH_DELIVERABILITY_OPS_QA_MARKER,
  type GrowthDeliverabilityOpsDashboard,
  type GrowthDeliverabilityRecommendation,
} from "@/lib/growth/deliverability-ops/deliverability-ops-types"

const SEVERITY_TONE: Record<string, "healthy" | "medium" | "attention" | "critical" | "neutral"> = {
  low: "neutral",
  medium: "medium",
  high: "attention",
  critical: "critical",
  open: "attention",
  acknowledged: "medium",
  in_progress: "medium",
  completed: "healthy",
  dismissed: "neutral",
  stable: "neutral",
  improving: "healthy",
  declining: "attention",
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function scoreTone(score: number, invert = false): "healthy" | "attention" | "critical" | "neutral" {
  const effective = invert ? 100 - score : score
  if (effective >= 70) return "healthy"
  if (effective >= 45) return "attention"
  return "critical"
}

export function GrowthDeliverabilityOpsDashboardView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthDeliverabilityOpsDashboard | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/deliverability-ops/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as {
        ok?: boolean
        dashboard?: GrowthDeliverabilityOpsDashboard
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load deliverability ops dashboard.")
      }
      setDashboard(payload.dashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load deliverability ops dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function recommendationAction(
    recommendation: GrowthDeliverabilityRecommendation,
    action: "acknowledge" | "complete" | "dismiss",
  ) {
    setActionId(recommendation.id)
    setError(null)
    try {
      const response = await fetch(
        `/api/platform/growth/deliverability-ops/recommendations/${recommendation.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ humanApprovalConfirmed: true }),
        },
      )
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? `Could not ${action} recommendation.`)
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Recommendation action failed.")
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_DELIVERABILITY_OPS_QA_MARKER} · {GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE}
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      ) : null}

      {loading && !dashboard ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading deliverability operations center…
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Overall Deliverability" value={`${dashboard.overallDeliverability}`} />
            <StatTile label="Sender Reputation" value={`${dashboard.senderReputation}`} />
            <StatTile label="Domain Health" value={`${dashboard.domainHealth}`} />
            <StatTile label="Provider Health" value={`${dashboard.providerHealth}`} />
            <StatTile label="Compliance Risk" value={`${dashboard.complianceRisk}`} />
            <StatTile label="Warmup Health" value={`${dashboard.warmupHealth}`} />
            <StatTile label="Volume Pressure" value={`${dashboard.volumePressure}`} />
            <StatTile label="Risk Alerts" value={String(dashboard.riskAlerts)} />
          </div>

          <GrowthEngineCard title="Recommendations">
            <p className="mb-3 text-sm text-muted-foreground">
              Advisory only — every recommendation requires evidence. No automatic DNS, sender, volume, or provider changes.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Entity</th>
                    <th className="py-2 pr-3">Severity</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Evidence</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recommendations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">
                        No recommendations — platform looks healthy.
                      </td>
                    </tr>
                  ) : (
                    dashboard.recommendations.map((rec) => (
                      <tr key={rec.id} className="border-b border-border/50 align-top">
                        <td className="py-2 pr-3">{deliverabilityRecommendationTypeLabel(rec.recommendationType)}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{rec.title}</div>
                          <div className="text-xs text-muted-foreground">{rec.description}</div>
                        </td>
                        <td className="py-2 pr-3">{rec.entityLabel}</td>
                        <td className="py-2 pr-3">
                          <GrowthBadge
                            label={deliverabilitySeverityLabel(rec.severity)}
                            tone={SEVERITY_TONE[rec.severity] ?? "neutral"}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <GrowthBadge
                            label={deliverabilityOpsStatusLabel(rec.status)}
                            tone={SEVERITY_TONE[rec.status] ?? "neutral"}
                          />
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          <ul className="space-y-1">
                            {rec.evidence.slice(0, 3).map((item, idx) => (
                              <li key={`${rec.id}-ev-${idx}`}>
                                {item.label}: {item.value}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {rec.status === "open" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={actionId === rec.id}
                                onClick={() => void recommendationAction(rec, "acknowledge")}
                              >
                                Acknowledge
                              </Button>
                            ) : null}
                            {["open", "acknowledged", "in_progress"].includes(rec.status) ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={actionId === rec.id}
                                  onClick={() => void recommendationAction(rec, "complete")}
                                >
                                  Complete
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionId === rec.id}
                                  onClick={() => void recommendationAction(rec, "dismiss")}
                                >
                                  Dismiss
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GrowthEngineCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <GrowthEngineCard title="Risk Events">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3">Risk</th>
                      <th className="py-2 pr-3">Entity</th>
                      <th className="py-2 pr-3">Severity</th>
                      <th className="py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.riskEvents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-muted-foreground">
                          No risk events detected.
                        </td>
                      </tr>
                    ) : (
                      dashboard.riskEvents.map((risk) => (
                        <tr key={risk.id} className="border-b border-border/50">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{deliverabilityRiskTypeLabel(risk.riskType)}</div>
                            <div className="text-xs text-muted-foreground">{risk.title}</div>
                          </td>
                          <td className="py-2 pr-3">{risk.entityLabel}</td>
                          <td className="py-2 pr-3">
                            <GrowthBadge
                              label={deliverabilitySeverityLabel(risk.severity)}
                              tone={SEVERITY_TONE[risk.severity] ?? "neutral"}
                            />
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">{formatWhen(risk.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GrowthEngineCard>

            <GrowthEngineCard title="Remediation Tasks">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3">Task</th>
                      <th className="py-2 pr-3">Entity</th>
                      <th className="py-2 pr-3">Checklist</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.remediationTasks.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-muted-foreground">
                          No remediation tasks.
                        </td>
                      </tr>
                    ) : (
                      dashboard.remediationTasks.map((task) => (
                        <tr key={task.id} className="border-b border-border/50 align-top">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{task.title}</div>
                            <div className="text-xs text-muted-foreground">{task.description}</div>
                          </td>
                          <td className="py-2 pr-3">{task.entityLabel}</td>
                          <td className="py-2 pr-3 text-xs">
                            <ul className="space-y-1">
                              {task.checklist.slice(0, 4).map((item) => (
                                <li key={item.id} className={item.completed ? "line-through text-muted-foreground" : ""}>
                                  {item.label}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-2">
                            <GrowthBadge
                              label={deliverabilityOpsStatusLabel(task.status)}
                              tone={SEVERITY_TONE[task.status] ?? "neutral"}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GrowthEngineCard>
          </div>

          <GrowthEngineCard title="Domain Reputation History">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Domain</th>
                    <th className="py-2 pr-3">Reputation</th>
                    <th className="py-2 pr-3">Bounce</th>
                    <th className="py-2 pr-3">Complaint</th>
                    <th className="py-2 pr-3">Auth</th>
                    <th className="py-2 pr-3">Trend</th>
                    <th className="py-2">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.domainReputationHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">
                        No domain reputation history yet.
                      </td>
                    </tr>
                  ) : (
                    dashboard.domainReputationHistory.map((row) => (
                      <tr key={row.id} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-medium">{row.domainLabel}</td>
                        <td className="py-2 pr-3">
                          <GrowthBadge label={String(row.reputationScore)} tone={scoreTone(row.reputationScore)} />
                        </td>
                        <td className="py-2 pr-3">{row.bounceRate.toFixed(1)}%</td>
                        <td className="py-2 pr-3">{row.complaintRate.toFixed(2)}%</td>
                        <td className="py-2 pr-3">{row.authenticationScore}</td>
                        <td className="py-2 pr-3">
                          <GrowthBadge label={row.trend} tone={SEVERITY_TONE[row.trend] ?? "neutral"} />
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{formatWhen(row.recordedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GrowthEngineCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <GrowthEngineCard title="Sender Risk Summary">
              {dashboard.senderRiskSummary.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sender risks in current window.</p>
              ) : (
                <ul className="space-y-2">
                  {dashboard.senderRiskSummary.map((row) => (
                    <li key={row.entityLabel} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span>{row.entityLabel}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{row.riskCount} risks</span>
                        <GrowthBadge
                          label={row.topRiskType ? deliverabilityRiskTypeLabel(row.topRiskType) : "—"}
                          tone={SEVERITY_TONE[row.highestSeverity] ?? "neutral"}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>

            <GrowthEngineCard title="Provider Route Risk Summary">
              {dashboard.providerRouteRiskSummary.length === 0 ? (
                <p className="text-sm text-muted-foreground">No provider route risks in current window.</p>
              ) : (
                <ul className="space-y-2">
                  {dashboard.providerRouteRiskSummary.map((row) => (
                    <li key={row.entityLabel} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span>{row.entityLabel}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{row.riskCount} risks</span>
                        <GrowthBadge
                          label={row.topRiskType ? deliverabilityRiskTypeLabel(row.topRiskType) : "—"}
                          tone={SEVERITY_TONE[row.highestSeverity] ?? "neutral"}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GrowthEngineCard>
          </div>

          <GrowthEngineCard title="Advisory notice">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>
                Deliverability Ops monitors health across senders, domains, providers, pools, warmup, compliance, and
                transport. Recommendations never execute automatically — operators must manually apply approved changes
                in infrastructure, DNS, or provider consoles.
              </p>
            </div>
          </GrowthEngineCard>
        </>
      ) : null}
    </div>
  )
}
