"use client"

import { useCallback, useEffect, useState } from "react"
import { Brain, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  relationshipStageLabel,
  type GrowthLeadMemoryProfileView,
} from "@/lib/growth/lead-memory/memory-types"

export function GrowthCallWorkspaceRelationshipSummaryPanel({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true)
  const [profileView, setProfileView] = useState<GrowthLeadMemoryProfileView | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/platform/growth/lead-memory/profile/${encodeURIComponent(leadId)}`, {
        cache: "no-store",
      })
      const payload = (await response.json()) as { profile?: GrowthLeadMemoryProfileView }
      if (response.ok && payload.profile) setProfileView(payload.profile)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/50 p-3 text-xs text-muted-foreground dark:border-white/5">
        <Loader2 className="size-3.5 animate-spin" />
        Loading relationship summary…
      </div>
    )
  }

  const profile = profileView?.profile
  if (!profile) {
    return (
      <div className="rounded-xl border border-border/50 p-3 dark:border-white/5">
        <div className="mb-1 flex items-center gap-2">
          <Brain className="size-3.5 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relationship Summary</p>
        </div>
        <p className="text-sm text-muted-foreground">No memory profile yet for this lead.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 p-3 dark:border-white/5">
      <div className="mb-2 flex items-center gap-2">
        <Brain className="size-3.5 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relationship Summary</p>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <GrowthBadge label={relationshipStageLabel(profile.relationshipStage)} tone="healthy" />
        <GrowthBadge label={`${profile.memoryCoverageScore}%`} tone="neutral" />
      </div>
      <p className="text-sm leading-snug">{profile.summary || "Evidence-backed memory on file."}</p>
      {profileView?.objections.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Objections: {profileView.objections.slice(0, 2).map((o) => o.objectionLabel).join(", ")}
        </p>
      ) : null}
    </div>
  )
}
