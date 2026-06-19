"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthVideoAutopilotPreview } from "@/components/growth/videos/growth-video-autopilot-preview"
import type {
  GrowthVideoAutopilotPreviewBundle,
  GrowthVideoAutopilotRecommendation,
} from "@/lib/growth/videos/growth-video-autopilot-types"

export function GrowthVideoAutopilotPanel({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<GrowthVideoAutopilotRecommendation[]>([])
  const [active, setActive] = useState<GrowthVideoAutopilotRecommendation | null>(null)
  const [preview, setPreview] = useState<GrowthVideoAutopilotPreviewBundle | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/growth/videos/autopilot/recommendations?lead_id=${encodeURIComponent(leadId)}`,
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        recommendations?: GrowthVideoAutopilotRecommendation[]
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load recommendations.")
      setRecommendations(data.recommendations ?? [])
      setActive(data.recommendations?.[0] ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function generateRecommendation() {
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/videos/autopilot/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, persist: true }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        recommendation?: GrowthVideoAutopilotRecommendation
        preview?: GrowthVideoAutopilotPreviewBundle
      }
      if (!res.ok || !data.ok || !data.recommendation) {
        throw new Error(data.message ?? "Could not generate recommendation.")
      }
      setActive(data.recommendation)
      setPreview(data.preview ?? null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed.")
    } finally {
      setActing(false)
    }
  }

  async function reviewRecommendation(status: "approved" | "dismissed") {
    if (!active) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/growth/videos/autopilot/recommendations/${encodeURIComponent(active.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId, status }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        recommendation?: GrowthVideoAutopilotRecommendation
      }
      if (!res.ok || !data.ok || !data.recommendation) {
        throw new Error(data.message ?? "Could not update recommendation.")
      }
      setActive(data.recommendation)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed.")
    } finally {
      setActing(false)
    }
  }

  async function loadPreview(recommendation: GrowthVideoAutopilotRecommendation) {
    setActing(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/growth/videos/autopilot/recommendations/${encodeURIComponent(recommendation.id)}?lead_id=${encodeURIComponent(leadId)}`,
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        recommendation?: GrowthVideoAutopilotRecommendation
        preview?: GrowthVideoAutopilotPreviewBundle
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load preview.")
      setActive(data.recommendation ?? recommendation)
      setPreview(data.preview ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.")
    } finally {
      setActing(false)
    }
  }

  return (
    <GrowthEnginePanelResilience
      loading={loading}
      error={error}
      isEmpty={!loading && !error && recommendations.length === 0}
      emptyKind="no_data"
      emptyTitle="No video recommendations yet"
      emptyMessage="Generate a recommendation to review a personalized video campaign proposal."
      onRetry={() => void load()}
    >
      <GrowthEngineCard
        title="Video Autopilot"
        description="AI-designed personalized video campaign recommendations. Human approval required — nothing sends automatically."
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void generateRecommendation()} disabled={acting}>
            {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate recommendation
          </Button>
          {active ? (
            <>
              <Button variant="outline" onClick={() => void loadPreview(active)} disabled={acting}>
                Preview
              </Button>
              <Button variant="secondary" onClick={() => void reviewRecommendation("approved")} disabled={acting}>
                Approve
              </Button>
              <Button variant="ghost" onClick={() => void reviewRecommendation("dismissed")} disabled={acting}>
                Dismiss
              </Button>
            </>
          ) : null}
        </div>

        {active ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-medium">Status:</span> {active.status}
            </p>
            <p>
              <span className="font-medium">Should send video:</span> {active.shouldSendVideo ? "Yes" : "No"}
            </p>
            <p>
              <span className="font-medium">Video type:</span> {active.videoType}
            </p>
            <p>
              <span className="font-medium">Priority:</span> {active.scores.recommendedPriority} (
              {active.scores.videoOpportunityScore}/100)
            </p>
            <p>
              <span className="font-medium">Reasons:</span> {active.scores.reasons.join(", ") || "None"}
            </p>
            <p>
              <span className="font-medium">Channel:</span> {active.recommended.channel}
            </p>
          </div>
        ) : null}

        {recommendations.length > 1 ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Recent recommendations</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {recommendations.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <button type="button" className="underline" onClick={() => void loadPreview(entry)}>
                    {entry.videoType} — {entry.status} — {entry.scores.videoOpportunityScore}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {preview ? <GrowthVideoAutopilotPreview preview={preview} recommendation={active} /> : null}
      </GrowthEngineCard>
    </GrowthEnginePanelResilience>
  )
}
