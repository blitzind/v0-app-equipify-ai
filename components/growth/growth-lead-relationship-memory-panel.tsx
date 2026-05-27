"use client"

import { useCallback, useEffect, useState } from "react"
import { Brain, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  memoryCategoryLabel,
  relationshipStageLabel,
  type GrowthLeadMemoryProfileView,
} from "@/lib/growth/lead-memory/memory-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadRelationshipMemoryPanelProps = {
  lead: GrowthLead
}

type ProfilePayload = {
  ok?: boolean
  profile?: GrowthLeadMemoryProfileView
  message?: string
}

export function GrowthLeadRelationshipMemoryPanel({ lead }: GrowthLeadRelationshipMemoryPanelProps) {
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [profileView, setProfileView] = useState<GrowthLeadMemoryProfileView | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/platform/growth/lead-memory/profile/${encodeURIComponent(lead.id)}`, {
        cache: "no-store",
      })
      const payload = (await response.json()) as ProfilePayload
      if (response.ok && payload.profile) setProfileView(payload.profile)
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  async function rebuild() {
    setRebuilding(true)
    try {
      const response = await fetch(`/api/platform/growth/lead-memory/rebuild/${encodeURIComponent(lead.id)}`, {
        method: "POST",
      })
      const payload = (await response.json()) as ProfilePayload
      if (response.ok && payload.profile) setProfileView(payload.profile)
      else await load()
    } finally {
      setRebuilding(false)
    }
  }

  const profile = profileView?.profile
  const collapsedSummary = loading
    ? "Loading…"
    : profile
      ? `${relationshipStageLabel(profile.relationshipStage)} · ${profile.memoryCoverageScore}% coverage`
      : "No memory profile"

  return (
    <GrowthCollapsibleEngineCard
      title="Relationship Memory"
      icon={<Brain className="size-4" />}
      headerAside={collapsedSummary}
      persistKey={GROWTH_DRAWER_CARD_KEYS.relationshipMemory}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading relationship memory…
        </div>
      ) : !profile ? (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">No memory profile for this lead yet.</p>
          <Button size="sm" variant="outline" disabled={rebuilding} onClick={() => void rebuild()}>
            {rebuilding ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Rebuild memory
          </Button>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={relationshipStageLabel(profile.relationshipStage)} tone="healthy" />
            <GrowthBadge label={`${profile.memoryCoverageScore}% coverage`} tone="neutral" />
            <GrowthBadge label={profile.highestConfidence} tone="medium" />
          </div>

          {profile.summary ? <p className="text-foreground">{profile.summary}</p> : null}

          {profileView?.objections.length ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top objections</p>
              <ul className="space-y-1">
                {profileView.objections.slice(0, 3).map((objection) => (
                  <li key={objection.id} className="text-muted-foreground">
                    {objection.objectionLabel} — {objection.evidenceSnippet.slice(0, 80)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {profileView?.preferences.length ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preferences</p>
              <ul className="space-y-1">
                {profileView.preferences.slice(0, 3).map((pref) => (
                  <li key={pref.id} className="text-muted-foreground">
                    {pref.preferenceValue.replace(/_/g, " ")} — {pref.evidenceSnippet.slice(0, 80)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {profileView?.events.length ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent signals</p>
              <ul className="space-y-1">
                {profileView.events.slice(0, 4).map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center gap-2">
                    <span>{event.title}</span>
                    <GrowthBadge label={memoryCategoryLabel(event.memoryCategory)} tone="neutral" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button size="sm" variant="outline" disabled={rebuilding} onClick={() => void rebuild()}>
            {rebuilding ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Rebuild memory
          </Button>
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
