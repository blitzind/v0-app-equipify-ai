"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Layers, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { VoiceMultichannelIntelligenceWorkspaceSnapshot } from "@/lib/voice/multi-channel-intelligence/types"
import { VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER } from "@/lib/voice/multi-channel-intelligence/types"

export function GrowthMultichannelIntelligenceWorkspace() {
  const [workspace, setWorkspace] = useState<VoiceMultichannelIntelligenceWorkspaceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/voice/multichannel-intelligence/workspace", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        workspace?: VoiceMultichannelIntelligenceWorkspaceSnapshot
        message?: string
      }
      if (!res.ok || !data.workspace) {
        throw new Error(data.message ?? "Could not load multi-channel intelligence workspace.")
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
        Loading unified communications intelligence…
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

  const { health, activeThreads, recentEvents, preferredChannelInsights, recommendations } = workspace

  return (
    <div className="space-y-6" data-voice-multichannel-intelligence-qa-marker={VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge label="Operator-controlled" tone="neutral" />
          <GrowthBadge label="No autonomous omnichannel" tone="neutral" />
          {health.relationshipCommunicationRisk !== "low" ? (
            <GrowthBadge label={`Communication risk: ${health.relationshipCommunicationRisk}`} tone="attention" />
          ) : (
            <GrowthBadge label="Communication risk: low" tone="healthy" />
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{workspace.message}</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active threads" value={String(activeThreads.length)} />
        <StatTile label="Engagement continuity" value={`${health.engagementContinuityScore}%`} />
        <StatTile label="Unresolved chains" value={String(health.unresolvedChainCount)} />
        <StatTile label="Fatigue warnings" value={String(health.fatigueCount)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Active communication threads" icon={<Layers className="size-4" />}>
          {activeThreads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active communication threads.</p>
          ) : (
            <ul className="space-y-3">
              {activeThreads.slice(0, 8).map((t) => (
                <li key={t.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge label={t.currentState.replace(/_/g, " ")} tone="neutral" />
                    <span className="font-medium">{t.threadType.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.communicationSummary || "Unified communication thread"}</p>
                  {t.preferredChannel ? (
                    <p className="mt-1 text-xs">Preferred: {t.preferredChannel.replace(/_/g, " ")}</p>
                  ) : null}
                  {t.unresolvedIssueCount > 0 ? (
                    <p className="mt-1 text-xs text-amber-700">{t.unresolvedIssueCount} unresolved issue(s)</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Preferred channel insights" icon={<Layers className="size-4" />}>
          {preferredChannelInsights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No preferred channel patterns detected yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {preferredChannelInsights.map((insight, i) => (
                <li key={`${insight.channel}-${i}`} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{insight.channel.replace(/_/g, " ")}</span>{" "}
                  ({insight.confidence}) — {insight.reason}
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>

      {recommendations.length > 0 ? (
        <GrowthEngineCard title="Recommended next actions (operator review)" icon={<AlertTriangle className="size-4" />}>
          <ul className="space-y-2 text-sm">
            {recommendations.slice(0, 6).map((r, i) => (
              <li key={`${r.action}-${i}`} className="text-muted-foreground">
                {r.action}
                <span className="ml-2 text-xs opacity-70">— {r.evidence}</span>
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      {recentEvents.length > 0 ? (
        <GrowthEngineCard title="Unified communication timeline" icon={<Layers className="size-4" />}>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {recentEvents.slice(0, 12).map((e) => (
              <li key={e.id}>
                <span className="font-medium text-foreground">{e.eventType.replace(/_/g, " ")}</span>{" "}
                via {e.channel.replace(/_/g, " ")} — {e.evidenceText}
                <span className="ml-2 opacity-70">{new Date(e.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}
    </div>
  )
}
