"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthVideoAutopilotDraftPreview } from "@/components/growth/videos/growth-video-autopilot-draft-preview"
import type { GrowthVideoAutopilotDraftPackage } from "@/lib/growth/videos/growth-video-autopilot-draft-types"
import type { GrowthVideoAutopilotRecommendation } from "@/lib/growth/videos/growth-video-autopilot-types"

export function GrowthVideoAutopilotDraftsPanel({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<GrowthVideoAutopilotDraftPackage[]>([])
  const [active, setActive] = useState<GrowthVideoAutopilotDraftPackage | null>(null)
  const [approvedRecommendation, setApprovedRecommendation] =
    useState<GrowthVideoAutopilotRecommendation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [draftRes, recRes] = await Promise.all([
        fetch(`/api/growth/videos/autopilot/drafts?lead_id=${encodeURIComponent(leadId)}`),
        fetch(`/api/growth/videos/autopilot/recommendations?lead_id=${encodeURIComponent(leadId)}`),
      ])
      const draftData = (await draftRes.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        drafts?: GrowthVideoAutopilotDraftPackage[]
      }
      const recData = (await recRes.json().catch(() => ({}))) as {
        ok?: boolean
        recommendations?: GrowthVideoAutopilotRecommendation[]
      }
      if (!draftRes.ok || !draftData.ok) {
        throw new Error(draftData.message ?? "Could not load drafts.")
      }
      setDrafts(draftData.drafts ?? [])
      setActive(draftData.drafts?.[0] ?? null)
      setApprovedRecommendation(
        recData.recommendations?.find((entry) => entry.status === "approved") ?? null,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function buildDraft() {
    if (!approvedRecommendation) {
      setError("Approve an F1 recommendation before building a draft package.")
      return
    }

    setActing(true)
    setError(null)
    try {
      const draftId = crypto.randomUUID()
      const res = await fetch(
        `/api/growth/videos/autopilot/drafts/${encodeURIComponent(draftId)}/build`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            recommendation_id: approvedRecommendation.id,
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        draft?: GrowthVideoAutopilotDraftPackage
      }
      if (!res.ok || !data.ok || !data.draft) {
        throw new Error(data.message ?? "Could not build draft package.")
      }
      setActive(data.draft)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed.")
    } finally {
      setActing(false)
    }
  }

  async function rebuildDraft() {
    if (!active || !approvedRecommendation) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/growth/videos/autopilot/drafts/${encodeURIComponent(active.id)}/build`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            recommendation_id: approvedRecommendation.id,
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        draft?: GrowthVideoAutopilotDraftPackage
      }
      if (!res.ok || !data.ok || !data.draft) {
        throw new Error(data.message ?? "Could not rebuild draft package.")
      }
      setActive(data.draft)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rebuild failed.")
    } finally {
      setActing(false)
    }
  }

  async function discardDraft() {
    if (!active) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/growth/videos/autopilot/drafts/${encodeURIComponent(active.id)}/discard`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Could not discard draft.")
      }
      setActive(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discard failed.")
    } finally {
      setActing(false)
    }
  }

  return (
    <GrowthEngineCard title="Video Autopilot Drafts (F2)">
      <GrowthEnginePanelResilience
        loading={loading}
        error={error}
        isEmpty={!loading && drafts.length === 0}
        emptyKind="no-data"
        onRetry={() => void load()}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Build staged draft packages from approved F1 recommendations. Drafts only — no sends,
            enrollments, or worker execution.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void buildDraft()} disabled={acting || !approvedRecommendation}>
              {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Build draft package
            </Button>
            {active ? (
              <>
                <Button variant="outline" onClick={() => void rebuildDraft()} disabled={acting}>
                  Rebuild
                </Button>
                <Button variant="destructive" onClick={() => void discardDraft()} disabled={acting}>
                  Discard
                </Button>
              </>
            ) : null}
          </div>

          {drafts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {drafts.map((draft) => (
                <Button
                  key={draft.id}
                  variant={active?.id === draft.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActive(draft)}
                >
                  {draft.status} · {draft.id.slice(0, 8)}
                </Button>
              ))}
            </div>
          ) : null}

          {active ? <GrowthVideoAutopilotDraftPreview draft={active} /> : null}
        </div>
      </GrowthEnginePanelResilience>
    </GrowthEngineCard>
  )
}
