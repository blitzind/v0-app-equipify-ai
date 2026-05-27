"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Brain, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_LEAD_MEMORY_ENGINE_QA_MARKER,
  GROWTH_LEAD_MEMORY_PRIVACY_NOTE,
  memoryCategoryLabel,
  relationshipStageLabel,
  type GrowthLeadMemoryDashboard,
  type GrowthLeadMemoryEvent,
  type GrowthLeadMemoryProfile,
} from "@/lib/growth/lead-memory/memory-types"

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthLeadMemoryDashboard
  privacy_note?: string
  message?: string
}

export function GrowthLeadMemoryDashboardView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthLeadMemoryDashboard | null>(null)
  const [rebuildId, setRebuildId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/lead-memory/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as DashboardPayload
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load relationship memory dashboard.")
      }
      setDashboard(payload.dashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load relationship memory dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function rebuildProfile(profile: GrowthLeadMemoryProfile) {
    setRebuildId(profile.leadId)
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/lead-memory/rebuild/${profile.leadId}`, {
        method: "POST",
      })
      const payload = (await response.json()) as { ok?: boolean; message?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Rebuild failed.")
      }
      await load()
    } catch (rebuildError) {
      setError(rebuildError instanceof Error ? rebuildError.message : "Rebuild failed.")
    } finally {
      setRebuildId(null)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading relationship memory…
      </div>
    )
  }

  const stageEntries = Object.entries(dashboard?.relationshipStages ?? {}).filter(([, count]) => count > 0)

  return (
    <div className="space-y-6">
      <GrowthEngineCard title="Relationship Memory" icon={<Brain className="size-4" />}>
        <p className="mb-4 text-xs text-muted-foreground">{GROWTH_LEAD_MEMORY_PRIVACY_NOTE}</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GrowthBadge label={GROWTH_LEAD_MEMORY_ENGINE_QA_MARKER} tone="neutral" />
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1 size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Memory Coverage" value={`${dashboard?.memoryCoverage ?? 0}%`} />
          <StatTile label="Committee Coverage" value={`${dashboard?.committeeCoverage ?? 0}%`} />
          <StatTile label="Buying Signals" value={dashboard?.buyingSignals ?? 0} />
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Relationship Stages">
          {!stageEntries.length ? (
            <p className="text-sm text-muted-foreground">No relationship profiles yet. Rebuild memory for a lead to populate.</p>
          ) : (
            <ul className="space-y-2">
              {stageEntries.map(([stage, count]) => (
                <li key={stage} className="flex items-center justify-between text-sm">
                  <span>{relationshipStageLabel(stage as GrowthLeadMemoryProfile["relationshipStage"])}</span>
                  <GrowthBadge label={String(count)} tone="neutral" />
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Communication Preferences">
          {!dashboard?.communicationPreferences.length ? (
            <p className="text-sm text-muted-foreground">No preference memory recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.communicationPreferences.map((pref) => (
                <li key={pref.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{pref.preferenceValue.replace(/_/g, " ")}</span>
                    <GrowthBadge label={pref.confidence} tone="medium" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{pref.evidenceSnippet}</p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Top Objections">
          {!dashboard?.topObjections.length ? (
            <p className="text-sm text-muted-foreground">No objection memory recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.topObjections.map((objection) => (
                <li key={objection.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{objection.objectionLabel}</span>
                    <GrowthBadge label={`×${objection.occurrenceCount}`} tone="attention" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{objection.evidenceSnippet}</p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Recent Memory Events">
          {!dashboard?.recentEvents.length ? (
            <p className="text-sm text-muted-foreground">No memory events yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dashboard.recentEvents.slice(0, 12).map((event: GrowthLeadMemoryEvent) => (
                <li key={event.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{event.title}</span>
                    <GrowthBadge label={memoryCategoryLabel(event.memoryCategory)} tone="neutral" />
                    <GrowthBadge label={event.confidence} tone="medium" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{event.evidenceSnippet}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {event.leadLabel} · {event.sourceSystem} · {formatWhen(event.recordedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Lead Memory Profiles">
        {!dashboard?.profiles.length ? (
          <p className="text-sm text-muted-foreground">
            No profiles yet. Open a lead drawer or inbox thread and rebuild memory for that lead.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Lead</th>
                  <th className="px-2 py-2 font-medium">Stage</th>
                  <th className="px-2 py-2 font-medium">Coverage</th>
                  <th className="px-2 py-2 font-medium">Events</th>
                  <th className="px-2 py-2 font-medium">Updated</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.profiles.map((profile) => (
                  <tr key={profile.id} className="border-b border-border/60">
                    <td className="px-2 py-2">{profile.leadLabel}</td>
                    <td className="px-2 py-2">
                      <GrowthBadge label={relationshipStageLabel(profile.relationshipStage)} tone="neutral" />
                    </td>
                    <td className="px-2 py-2 tabular-nums">{profile.memoryCoverageScore}%</td>
                    <td className="px-2 py-2 tabular-nums">{profile.eventCount}</td>
                    <td className="px-2 py-2 text-muted-foreground">{formatWhen(profile.updatedAt)}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/growth/leads?leadId=${encodeURIComponent(profile.leadId)}`}>Open lead</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={rebuildId === profile.leadId}
                          onClick={() => void rebuildProfile(profile)}
                        >
                          {rebuildId === profile.leadId ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : null}
                          Rebuild
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GrowthEngineCard>
    </div>
  )
}
