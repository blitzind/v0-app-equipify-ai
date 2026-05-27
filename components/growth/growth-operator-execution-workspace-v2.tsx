"use client"

import { useCallback, useEffect, useState } from "react"
import { Bot, Clock, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthMultichannelActivityEntry,
  type GrowthOperatorExecutionWorkspaceV2,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  call: "Call",
  sms: "SMS",
  linkedin: "LinkedIn",
  meeting: "Meeting",
  website: "Website",
  note: "Note",
  opportunity: "Opportunity",
  cadence: "Cadence",
  other: "Other",
}

export function GrowthMultiChannelTimelinePanel({ leadId }: { leadId?: string | null }) {
  const [entries, setEntries] = useState<GrowthMultichannelActivityEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!leadId) {
      setEntries([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/multichannel-revenue/timeline?leadId=${leadId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        timeline?: { entries: GrowthMultichannelActivityEntry[] }
        message?: string
      }
      if (!res.ok || !data.ok || !data.timeline) throw new Error(data.message ?? "Could not load timeline.")
      setEntries(data.timeline.entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4" data-qa-marker={GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <GrowthBadge label={GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER} tone="attention" />
        <Button size="sm" variant="outline" disabled={loading || !leadId} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh timeline
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_PRIVACY_NOTE}</p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!leadId ? (
        <p className="text-sm text-muted-foreground">Select an account to view the unified multi-channel activity timeline.</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No multi-channel timeline events yet. Sync runs when reply or revenue intelligence processes.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-border px-3 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{entry.title}</p>
                  <p className="text-muted-foreground">{entry.summary}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <GrowthBadge label={CHANNEL_LABELS[entry.channel] ?? entry.channel} tone="neutral" />
                  {entry.attributionType ? <GrowthBadge label={entry.attributionType} tone="attention" /> : null}
                </div>
              </div>
              {entry.evidenceExcerpt ? (
                <p className="mt-2 rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">{entry.evidenceExcerpt}</p>
              ) : null}
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {new Date(entry.occurredAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function GrowthOperatorExecutionWorkspaceV2Section() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<GrowthOperatorExecutionWorkspaceV2 | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/multichannel-revenue/workspace?limit=50", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; workspace?: typeof workspace; message?: string }
      if (!res.ok || !data.ok || !data.workspace) throw new Error(data.message ?? "Could not load workspace.")
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
        Loading operator execution workspace…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GrowthBadge label={GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER} tone="attention" />
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_PRIVACY_NOTE}</p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {workspace ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Stalled opportunities" value={workspace.stalledOpportunityCount} />
            <StatTile label="Follow-up risk" value={workspace.followUpRiskCount} />
            <StatTile label="No-response patterns" value={workspace.noResponsePatternCount} />
            <StatTile label="Best next touch" value={workspace.bestNextTouchpoint.slice(0, 28) + (workspace.bestNextTouchpoint.length > 28 ? "…" : "")} />
          </div>

          <GrowthEngineCard title="Channel engagement mix">
            {workspace.channelEngagementMix.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channel mix data yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 text-sm">
                {workspace.channelEngagementMix.map((mix) => (
                  <li key={mix.channel} className="rounded-md border px-2 py-1">
                    {CHANNEL_LABELS[mix.channel] ?? mix.channel}: {mix.touchCount}
                  </li>
                ))}
              </ul>
            )}
          </GrowthEngineCard>

          {workspace.channelFatigueWarnings.length > 0 ? (
            <GrowthEngineCard title="Channel fatigue warnings">
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                {workspace.channelFatigueWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </GrowthEngineCard>
          ) : null}

          <GrowthEngineCard title="Operator execution accounts">
            {workspace.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts in workspace view.</p>
            ) : (
              <ul className="space-y-2">
                {workspace.items.map((item) => (
                  <li key={item.leadId} className="rounded-lg border border-border px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.companyLabel}</p>
                        <p className="text-muted-foreground">{item.bestNextTouchpoint}</p>
                      </div>
                      <GrowthBadge label={`Momentum ${item.momentumScore}`} tone={item.momentumScore >= 65 ? "healthy" : "neutral"} />
                    </div>
                    {item.engagementGap ? <p className="mt-1 text-xs text-amber-700">Gap: {item.engagementGap}</p> : null}
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
                      onClick={() => setSelectedLeadId(item.leadId)}
                    >
                      View multi-channel timeline
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GrowthEngineCard>
        </>
      ) : null}

      <div data-qa-marker={GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER}>
        <GrowthEngineCard title="Multi-channel activity timeline" icon={<Bot className="size-4" />}>
          <GrowthMultiChannelTimelinePanel leadId={selectedLeadId} />
        </GrowthEngineCard>
      </div>
    </div>
  )
}
