"use client"

import { useCallback, useEffect, useState } from "react"
import { Brain, Loader2 } from "lucide-react"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  relationshipStageLabel,
  type GrowthLeadMemoryProfileView,
} from "@/lib/growth/lead-memory/memory-types"

type GrowthInboxRelationshipMemoryPanelProps = {
  leadId: string | null
  threadId: string
  disabled?: boolean
}

type ProfilePayload = {
  ok?: boolean
  profile?: GrowthLeadMemoryProfileView
}

export function GrowthInboxRelationshipMemoryPanel({
  leadId,
  threadId,
  disabled,
}: GrowthInboxRelationshipMemoryPanelProps) {
  const [loading, setLoading] = useState(false)
  const [profileView, setProfileView] = useState<GrowthLeadMemoryProfileView | null>(null)

  const load = useCallback(async () => {
    if (!leadId) {
      setProfileView(null)
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`/api/platform/growth/lead-memory/profile/${encodeURIComponent(leadId)}`, {
        cache: "no-store",
      })
      const payload = (await response.json()) as ProfilePayload
      if (response.ok && payload.profile) setProfileView(payload.profile)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load, threadId])

  if (!leadId) return null

  const profile = profileView?.profile
  const context = profileView?.relationshipContext

  return (
    <GrowthEngineCard title="Relationship Context" icon={<Brain className="size-4" />}>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading relationship context…
        </div>
      ) : !profile ? (
        <p className="text-sm text-muted-foreground">
          No relationship memory for this lead yet. Rebuild from the lead drawer when ready.
        </p>
      ) : (
        <div className={`space-y-3 text-sm ${disabled ? "pointer-events-none opacity-60" : ""}`}>
          <div className="flex flex-wrap gap-2">
            <GrowthBadge label={relationshipStageLabel(profile.relationshipStage)} tone="healthy" />
            {context ? <GrowthBadge label={context.engagementTrend} tone="medium" /> : null}
            <GrowthBadge label={`${profile.memoryCoverageScore}% coverage`} tone="neutral" />
          </div>
          {profile.summary ? <p className="text-foreground">{profile.summary}</p> : null}
          {context?.topSignals.length ? (
            <ul className="space-y-1 text-muted-foreground">
              {context.topSignals.slice(0, 4).map((signal) => (
                <li key={signal}>• {signal}</li>
              ))}
            </ul>
          ) : null}
          {profileView?.objections.length ? (
            <p className="text-xs text-muted-foreground">
              Active objections: {profileView.objections.slice(0, 2).map((o) => o.objectionLabel).join(", ")}
            </p>
          ) : null}
        </div>
      )}
    </GrowthEngineCard>
  )
}
