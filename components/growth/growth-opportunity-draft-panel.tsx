"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { OpportunityDraftRow } from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER } from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"

export function GrowthOpportunityDraftPanel({
  meetingId,
  meetingStatus,
}: {
  meetingId: string
  meetingStatus: string
}) {
  const [draft, setDraft] = useState<OpportunityDraftRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdOpportunityId, setCreatedOpportunityId] = useState<string | null>(null)

  const showPanel = meetingStatus === "completed"

  const loadDraft = useCallback(async () => {
    if (!showPanel) {
      setDraft(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/opportunity-drafts/queue?meetingId=${encodeURIComponent(meetingId)}&status=all&limit=5`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as { items?: OpportunityDraftRow[] }
      if (!res.ok) throw new Error("Could not load opportunity drafts.")
      const items = data.items ?? []
      const latest =
        items.find((item) => item.status === "approved") ??
        items.find((item) => item.status === "converted") ??
        items.find((item) => item.status === "draft") ??
        null
      setDraft(latest)
      if (latest?.status === "converted" && latest.opportunity_id) {
        setCreatedOpportunityId(latest.opportunity_id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opportunity draft load failed.")
      setDraft(null)
    } finally {
      setLoading(false)
    }
  }, [meetingId, showPanel])

  useEffect(() => {
    void loadDraft()
  }, [loadDraft])

  const runDraftAction = useCallback(
    async (action: "approve_opportunity_draft" | "reject_opportunity_draft" | "create_opportunity") => {
      if (!draft?.draft_id) return
      setActionLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/platform/growth/opportunity-drafts/queue/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, draftId: draft.draft_id }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          opportunity_id?: string | null
          draft_status?: OpportunityDraftRow["status"] | null
          message?: string
        }
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? "Opportunity draft action failed.")
        }
        if (action === "create_opportunity" && data.opportunity_id) {
          setCreatedOpportunityId(data.opportunity_id)
        }
        await loadDraft()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Opportunity draft action failed.")
      } finally {
        setActionLoading(false)
      }
    },
    [draft?.draft_id, loadDraft],
  )

  if (!showPanel) return null

  return (
    <div
      className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
      data-qa-marker={OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER}
    >
      <div>
        <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">Opportunity Drafts Ready</p>
        <p className="text-xs text-emerald-900/80 dark:text-emerald-100/80">
          Review post-meeting draft, approve, then explicitly create the Growth Opportunity.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading opportunity draft…
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {!loading && !draft ? (
        <p className="text-xs text-muted-foreground">No opportunity draft for this completed meeting yet.</p>
      ) : null}

      {draft ? (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge
              label={draft.status}
              tone={
                draft.status === "converted"
                  ? "healthy"
                  : draft.status === "approved"
                    ? "medium"
                    : draft.status === "rejected"
                      ? "attention"
                      : "neutral"
              }
            />
            <span className="text-muted-foreground tabular-nums">
              Confidence {(draft.confidence_score * 100).toFixed(0)}%
            </span>
            <span className="text-muted-foreground tabular-nums">
              Value ${draft.estimated_value.toLocaleString()}
            </span>
            <span className="text-muted-foreground">Stage {draft.recommended_stage}</span>
          </div>

          <p className="leading-relaxed">{draft.opportunity_summary}</p>

          {draft.next_steps.length > 0 ? (
            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
              {draft.next_steps.slice(0, 4).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {draft.status === "draft" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => void runDraftAction("approve_opportunity_draft")}
                >
                  Approve draft
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionLoading}
                  onClick={() => void runDraftAction("reject_opportunity_draft")}
                >
                  Reject draft
                </Button>
              </>
            ) : null}
            {draft.status === "approved" ? (
              <Button
                type="button"
                size="sm"
                disabled={actionLoading}
                onClick={() => void runDraftAction("create_opportunity")}
              >
                Create Opportunity
              </Button>
            ) : null}
          </div>

          {createdOpportunityId || draft.opportunity_id ? (
            <div className="rounded-md border border-emerald-300/60 bg-background/70 p-2">
              <p className="font-medium text-emerald-900 dark:text-emerald-100">Opportunity created</p>
              <Link
                href={`/admin/growth/opportunities/pipeline?opportunityId=${encodeURIComponent(createdOpportunityId ?? draft.opportunity_id ?? "")}`}
                className="text-emerald-700 hover:underline dark:text-emerald-300"
              >
                View opportunity in pipeline
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
