"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, Loader2, RefreshCw, Shield, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { VoiceObservabilityOverviewSnapshot } from "@/lib/voice/observability/types"
import {
  VOICE_OBSERVABILITY_QA_MARKER,
  VOICE_OBSERVABILITY_REALTIME_POLL_MS,
} from "@/lib/voice/observability/types"

export function GrowthVoiceObservabilityDashboard() {
  const [overview, setOverview] = useState<VoiceObservabilityOverviewSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/voice/observability/overview", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        overview?: VoiceObservabilityOverviewSnapshot
        message?: string
      }
      if (!res.ok || !data.overview) {
        throw new Error(data.message ?? "Could not load observability overview.")
      }
      setOverview(data.overview)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), VOICE_OBSERVABILITY_REALTIME_POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  if (loading && !overview) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading voice observability…
      </div>
    )
  }

  if (error && !overview) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">{error}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!overview) return null

  const { realtime, providerHealth, escalations, compliance, campaigns, aiOrchestration, relationshipRevenue } =
    overview

  return (
    <div className="space-y-6" data-voice-observability-qa-marker={VOICE_OBSERVABILITY_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge label="Autonomous remediation disabled" tone="neutral" />
          <GrowthBadge label="Auto provider switch disabled" tone="neutral" />
          {overview.activeAlertCount > 0 ? (
            <GrowthBadge label={`${overview.activeAlertCount} active alerts`} tone="attention" />
          ) : (
            <GrowthBadge label="No active alerts" tone="healthy" />
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{overview.message}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active voice sessions" value={realtime.activeSessionsCount} />
        <StatTile label="Outbound AI active" value={realtime.activeOutboundSessionsCount} />
        <StatTile label="Receptionist active" value={realtime.activeReceptionistSessionsCount} />
        <StatTile label="Escalations (24h)" value={escalations.escalationCount24h} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Provider health" icon={<Activity className="size-4" />}>
          {providerHealth.providers.filter((p) => p.sampleCount > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground">No provider events in rolling window.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {providerHealth.providers
                .filter((p) => p.sampleCount > 0)
                .slice(0, 6)
                .map((p) => (
                  <li key={p.providerId} className="rounded-lg border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{p.providerId.replace(/_/g, " ")}</span>
                      {p.degradationDetected ? (
                        <GrowthBadge label="degradation" tone="attention" />
                      ) : (
                        <GrowthBadge label="healthy" tone="healthy" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Avg {p.avgLatencyMs}ms · fallback {p.fallbackRate}% · timeout {p.timeoutRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">{p.recommendation}</p>
                  </li>
                ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Active alerts" icon={<AlertTriangle className="size-4" />}>
          {realtime.activeAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No passive alerts triggered.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {realtime.activeAlerts.map((alert) => (
                <li key={alert.id} className="rounded-lg border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium capitalize">{alert.alertType.replace(/_/g, " ")}</span>
                    <GrowthBadge label={alert.severity} tone={alert.severity === "critical" ? "attention" : "neutral"} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Triggered {new Date(alert.triggeredAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Escalation heatmap (24h)" icon={<Radio className="size-4" />}>
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {escalations.heatmap.map((bucket) => (
              <div
                key={bucket.hour}
                className="rounded border px-1 py-2 text-center text-xs"
                title={`Hour ${bucket.hour}: ${bucket.count} events`}
              >
                <div className="font-medium">{bucket.hour}</div>
                <div className="text-muted-foreground">{bucket.count}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Operator takeovers: {escalations.operatorTakeoverCount24h} · Transfers: {escalations.transferCount24h}
          </p>
        </GrowthEngineCard>

        <GrowthEngineCard title="Compliance analytics (24h)" icon={<Shield className="size-4" />}>
          <ul className="space-y-1 text-sm">
            <li>Blocked: {compliance.blockedCount24h}</li>
            <li>Manual review: {compliance.manualReviewCount24h}</li>
            <li>Opt-outs: {compliance.optOutCount24h}</li>
            <li>Call-hour violations: {compliance.callHourViolationCount24h}</li>
            <li>Consent unknown: {compliance.consentUnknownCount24h}</li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{compliance.message}</p>
        </GrowthEngineCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Campaign + recovery">
          <ul className="space-y-1 text-sm">
            <li>Voice drop delivery rate: {campaigns.voiceDropDeliveryRate}%</li>
            <li>Voice drop suppression rate: {campaigns.voiceDropSuppressionRate}%</li>
            <li>Missed-call recovery (24h): {campaigns.missedCallRecoveryCount24h}</li>
            <li>Outbound AI completion rate: {campaigns.outboundAiCompletionRate}%</li>
            <li>Opt-out terminations (24h): {campaigns.optOutTerminationCount24h}</li>
          </ul>
        </GrowthEngineCard>

        <GrowthEngineCard title="AI orchestration">
          <ul className="space-y-1 text-sm">
            <li>Suggestions (24h): {aiOrchestration.suggestionVolume24h}</li>
            <li>Adoption rate: {aiOrchestration.suggestionAdoptionRate}%</li>
            <li>AI fallbacks (24h): {aiOrchestration.aiFallbackFrequency24h}</li>
            <li>Voicemail completion: {aiOrchestration.voicemailCompletionRate}%</li>
            <li>Qualification completion: {aiOrchestration.qualificationCompletionRate}%</li>
          </ul>
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Relationship + revenue trends">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Retention risk</p>
            {relationshipRevenue.retentionRiskTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No retention risk events.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {relationshipRevenue.retentionRiskTrend.slice(0, 4).map((row) => (
                  <li key={row.label} className="flex justify-between gap-2">
                    <span className="capitalize">{row.label.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-muted-foreground">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Expansion signals</p>
            {relationshipRevenue.expansionOpportunityTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expansion signals.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {relationshipRevenue.expansionOpportunityTrend.slice(0, 4).map((row) => (
                  <li key={row.label} className="flex justify-between gap-2">
                    <span className="capitalize">{row.label.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-muted-foreground">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Follow-up adherence: {relationshipRevenue.followUpAdherenceRate}% · Escalation risk events:{" "}
          {relationshipRevenue.escalationRiskTrend}
        </p>
      </GrowthEngineCard>

      <GrowthEngineCard title="Recent operational events">
        {realtime.recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No observability events recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {realtime.recentEvents.slice(0, 12).map((event) => (
              <li key={event.id} className="flex flex-wrap justify-between gap-2 rounded border px-2 py-1">
                <span>
                  <span className="font-medium capitalize">{event.eventCategory.replace(/_/g, " ")}</span>
                  {" · "}
                  {event.eventType.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}
