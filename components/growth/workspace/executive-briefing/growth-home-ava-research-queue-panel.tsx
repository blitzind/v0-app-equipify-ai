"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_AVA_RESEARCH_QUEUE_API_PATH,
  GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL,
  GROWTH_AVA_RESEARCH_QUEUE_SAFETY_DISCLAIMER,
  type GrowthAvaResearchQueueApiResponse,
} from "@/lib/growth/ava-home/growth-ava-research-orchestrator-api-contract"
import type { GrowthAvaResearchLoopSummary } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"

type Props = {
  researchLoopSummary: GrowthAvaResearchLoopSummary | null
  onCompleted?: () => void
}

export function GrowthHomeAvaResearchQueuePanel({ researchLoopSummary, onCompleted }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestSummary, setLatestSummary] = useState<GrowthAvaResearchLoopSummary | null>(researchLoopSummary)

  const runOrchestrator = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(GROWTH_AVA_RESEARCH_QUEUE_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const payload = (await res.json()) as GrowthAvaResearchQueueApiResponse
      if (!res.ok || !payload.ok) {
        throw new Error(payload.blockReason ?? payload.message ?? "Research orchestrator failed.")
      }
      if (payload.summary) {
        setLatestSummary(payload.summary)
      }
      onCompleted?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research orchestrator failed.")
    } finally {
      setLoading(false)
    }
  }, [onCompleted])

  const summary = latestSummary
  const qualificationWaiting =
    summary != null && summary.qualificationSkipped > 0 && summary.qualificationCompleted === 0

  return (
    <section
      data-qa-section="home-ava-research-queue"
      className="rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/50 via-background to-background p-5 space-y-4 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 text-indigo-600" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Research loop</h2>
          <p className="text-sm text-muted-foreground">{GROWTH_AVA_RESEARCH_QUEUE_SAFETY_DISCLAIMER}</p>
        </div>
      </div>

      {summary ? (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label="Research complete" tone={qualificationWaiting ? "attention" : "healthy"} />
            {qualificationWaiting ? (
              <GrowthBadge label="Qualification waiting" tone="neutral" />
            ) : summary.qualificationCompleted > 0 ? (
              <GrowthBadge label="Qualified" tone="healthy" />
            ) : null}
            <span className="text-xs text-muted-foreground">
              {new Date(summary.completedAt).toLocaleString()}
            </span>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{summary.narrative}</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{summary.researchCompleted} researched</span>
            <span>·</span>
            <span>{summary.buyingSignalsVerified} buying signals</span>
            {summary.qualificationSkipped > 0 ? (
              <>
                <span>·</span>
                <span>{summary.qualificationSkipped} qualification waiting</span>
              </>
            ) : null}
            <span>·</span>
            <span>{summary.readyForOutreachReview} ready for review</span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" disabled={loading} onClick={() => void runOrchestrator()}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {GROWTH_AVA_RESEARCH_QUEUE_OPERATOR_LABEL}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={`${GROWTH_WORKSPACE_BASE_PATH}/leads`}>Review Revenue Queue</Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
