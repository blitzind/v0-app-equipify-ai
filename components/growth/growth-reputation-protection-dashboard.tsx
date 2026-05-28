"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_DELIVERABILITY_GOVERNANCE_QA_MARKER,
  GROWTH_DELIVERABILITY_H1_HARDENING_QA_MARKER,
  GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER,
  GROWTH_MAILBOX_REPUTATION_HEALTH_TIERS,
  GROWTH_MAILBOX_REPUTATION_INTELLIGENCE_QA_MARKER,
  GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE,
  GROWTH_SEND_THROTTLE_ENGINE_QA_MARKER,
  GROWTH_WARMUP_RAMP_ENGINE_QA_MARKER,
  type GrowthMailboxReputationHealthTier,
  type GrowthReputationProtectionDashboard,
} from "@/lib/growth/deliverability/reputation-protection-types"

const TIER_TONE: Record<GrowthMailboxReputationHealthTier, "healthy" | "medium" | "attention" | "critical" | "neutral"> =
  {
    healthy: "healthy",
    warming: "medium",
    caution: "attention",
    high_risk: "critical",
    protected: "attention",
    paused: "critical",
  }

function formatTier(tier: string): string {
  return tier.replace(/_/g, " ")
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function scoreTone(score: number): "healthy" | "attention" | "critical" | "neutral" {
  if (score >= 80) return "healthy"
  if (score >= 55) return "attention"
  return "critical"
}

export function GrowthReputationProtectionDashboardView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthReputationProtectionDashboard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/deliverability/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as {
        ok?: boolean
        dashboard?: GrowthReputationProtectionDashboard
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load deliverability protection dashboard.")
      }
      setDashboard(payload.dashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load deliverability protection dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-qa-marker={GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER}>
        <Loader2 className="size-4 animate-spin" />
        Loading deliverability protection…
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <GrowthEngineCard title="Deliverability protection unavailable">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
          Retry
        </Button>
      </GrowthEngineCard>
    )
  }

  if (!dashboard) return null

  return (
    <div
      className="flex flex-col gap-6"
      data-qa-marker={GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER}
      data-mailbox-reputation-qa={GROWTH_MAILBOX_REPUTATION_INTELLIGENCE_QA_MARKER}
      data-throttle-qa={GROWTH_SEND_THROTTLE_ENGINE_QA_MARKER}
      data-warmup-qa={GROWTH_WARMUP_RAMP_ENGINE_QA_MARKER}
      data-governance-qa={GROWTH_DELIVERABILITY_GOVERNANCE_QA_MARKER}
      data-h1-qa={GROWTH_DELIVERABILITY_H1_HARDENING_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-3xl space-y-1">
          <p className="text-sm text-muted-foreground">{GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE}</p>
          <p className="text-xs text-muted-foreground">
            Operational enforcement and sender health. DNS setup lives under Deliverability Infrastructure; telemetry
            under Deliverability Operations.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Mailboxes" value={String(dashboard.summary.total_mailboxes)} tone="neutral" />
        <StatTile label="Healthy" value={String(dashboard.summary.healthy_count)} tone="healthy" />
        <StatTile label="At risk" value={String(dashboard.summary.at_risk_count)} tone="attention" />
        <StatTile label="Paused" value={String(dashboard.summary.paused_count)} tone="critical" />
        <StatTile
          label="Avg risk score"
          value={`${dashboard.summary.average_risk_score}/100`}
          tone={scoreTone(dashboard.summary.average_risk_score)}
        />
      </div>

      {dashboard.recommended_actions.length > 0 ? (
        <GrowthEngineCard title="Recommended actions">
          <ul className="space-y-2 text-sm">
            {dashboard.recommended_actions.map((action) => (
              <li key={action} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthEngineCard title="At-risk mailboxes">
          {dashboard.at_risk_mailboxes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mailboxes in caution or high-risk tiers.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.at_risk_mailboxes.slice(0, 8).map((row) => (
                <div key={row.metrics.sender_account_id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-sm">{row.metrics.email_address}</span>
                    <GrowthBadge tone={TIER_TONE[row.health_tier]}>{formatTier(row.health_tier)}</GrowthBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Risk {row.risk_score}/100 · bounce {row.metrics.bounce_rate.toFixed(1)}% · complaints{" "}
                    {row.metrics.spam_complaint_rate.toFixed(2)}%
                  </p>
                  {row.risk_reasons[0] ? (
                    <p className="mt-2 text-xs text-amber-800">{row.risk_reasons[0]}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Paused mailboxes">
          {dashboard.paused_mailboxes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mailboxes currently paused by reputation rules.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.paused_mailboxes.map((row) => (
                <div key={row.metrics.sender_account_id} className="rounded-lg border border-destructive/30 p-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-destructive" />
                    <span className="font-medium text-sm">{row.metrics.email_address}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{row.recommended_actions[0]}</p>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>
      </div>

      {dashboard.operational_pause_states.length > 0 ? (
        <GrowthEngineCard title="Persistent pause enforcement">
          <div className="space-y-3">
            {dashboard.operational_pause_states.map((row) => (
              <div key={row.sender_account_id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{row.email_address}</span>
                  <GrowthBadge tone={row.paused ? "critical" : "medium"}>
                    {row.operator_override ? "Operator override" : "Paused"}
                  </GrowthBadge>
                </div>
                {row.pause_reason ? <p className="mt-1 text-xs text-muted-foreground">{row.pause_reason}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Paused {formatWhen(row.paused_at)}
                  {row.cooldown_until ? ` · cooldown until ${formatWhen(row.cooldown_until)}` : ""}
                </p>
              </div>
            ))}
          </div>
        </GrowthEngineCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <GrowthEngineCard title="Bounce trends">
          <div className="space-y-2">
            {dashboard.bounce_trends.map((bucket) => (
              <div key={bucket.label} className="flex items-center justify-between text-sm">
                <span>{bucket.label}</span>
                <span className="text-muted-foreground">{bucket.mailbox_count} mailboxes</span>
              </div>
            ))}
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Complaint trends">
          <div className="space-y-2">
            {dashboard.complaint_trends.map((bucket) => (
              <div key={bucket.label} className="flex items-center justify-between text-sm">
                <span>{bucket.label}</span>
                <span className="text-muted-foreground">{bucket.mailbox_count} mailboxes</span>
              </div>
            ))}
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Sending velocity">
          <div className="space-y-2">
            {dashboard.sending_velocity.slice(0, 6).map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="truncate pr-2">{row.label}</span>
                <span className="text-muted-foreground">
                  {row.daily_send_count} sent · {row.cap_utilization_pct}% cap
                </span>
              </div>
            ))}
          </div>
        </GrowthEngineCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthEngineCard title="Warmup progress">
          {dashboard.warmup_progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">No warmup profiles configured.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.warmup_progress.slice(0, 6).map((row, index) => (
                <div key={`${row.warmup_status}-${index}`} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{row.ramp_schedule_label}</span>
                    {row.unsafe_to_scale ? (
                      <GrowthBadge tone="critical">Unsafe to scale</GrowthBadge>
                    ) : (
                      <GrowthBadge tone="healthy">On track</GrowthBadge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Max {row.recommended_max_daily_volume}/day · {row.warmup_status}
                  </p>
                  <p className="mt-1 text-xs">{row.guidance[0]}</p>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Sequence risk">
          {dashboard.sequence_risk.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sequence participation flagged.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.sequence_risk.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{row.label}</span>
                  <span className="text-muted-foreground">
                    {row.sequence_count} sequences · risk {row.risk_score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Mailbox health">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Mailbox</th>
                <th className="py-2 pr-4 font-medium">Tier</th>
                <th className="py-2 pr-4 font-medium">Risk</th>
                <th className="py-2 pr-4 font-medium">7d volume</th>
                <th className="py-2 pr-4 font-medium">Bounce</th>
                <th className="py-2 pr-4 font-medium">Reply</th>
                <th className="py-2 pr-4 font-medium">Open</th>
                <th className="py-2 font-medium">Warmup</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.mailbox_health.slice(0, 12).map((row) => (
                <tr key={row.metrics.sender_account_id} className="border-b border-border/60">
                  <td className="py-2 pr-4">{row.metrics.email_address}</td>
                  <td className="py-2 pr-4">
                    <GrowthBadge tone={TIER_TONE[row.health_tier]}>{formatTier(row.health_tier)}</GrowthBadge>
                  </td>
                  <td className="py-2 pr-4">{row.risk_score}</td>
                  <td className="py-2 pr-4">{row.metrics.rolling_7d_send_volume}</td>
                  <td className="py-2 pr-4">{row.metrics.bounce_rate.toFixed(1)}%</td>
                  <td className="py-2 pr-4">{row.metrics.reply_rate.toFixed(1)}%</td>
                  <td className="py-2 pr-4">{row.metrics.open_rate.toFixed(1)}%</td>
                  <td className="py-2">{row.metrics.warmup_status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Health tiers: {GROWTH_MAILBOX_REPUTATION_HEALTH_TIERS.join(", ")}
        </p>
      </GrowthEngineCard>

      <GrowthEngineCard title="Governance timeline">
        {dashboard.recent_governance_events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No governance events recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {dashboard.recent_governance_events.map((event) => (
              <div key={event.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-sm">{event.title}</span>
                  <GrowthBadge tone={event.severity === "critical" ? "critical" : "medium"}>
                    {event.event_type.replace(/_/g, " ")}
                  </GrowthBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatWhen(event.created_at)}</p>
                <p className="mt-2 text-sm">{event.summary}</p>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>
    </div>
  )
}
