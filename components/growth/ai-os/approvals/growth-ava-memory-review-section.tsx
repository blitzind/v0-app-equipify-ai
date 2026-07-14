"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { buildAvaOperatorPackageMemoryActionsApiPath } from "@/lib/growth/mission-center/growth-ava-operator-workspace-contract"
import type { Approvals2AMemoryReviewRow } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"

type Props = {
  leadId: string
  packageId: string
  rows: Approvals2AMemoryReviewRow[]
  onUpdated?: (rows: Approvals2AMemoryReviewRow[]) => void
}

export function GrowthAvaMemoryReviewSection({ leadId, packageId, rows, onUpdated }: Props) {
  const [localRows, setLocalRows] = useState(rows)
  const [busyEventId, setBusyEventId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [correctingId, setCorrectingId] = useState<string | null>(null)
  const [correctText, setCorrectText] = useState("")
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState("")

  const visibleRows = useMemo(() => localRows.filter((row) => row.operatorStatus !== "deleted"), [localRows])
  const needsAttention = visibleRows.some((row) => row.operatorStatus === "pending")

  async function submitAction(
    eventId: string,
    action: "approve" | "correct" | "delete" | "pin" | "protect" | "merge",
    extra?: { correctedConclusion?: string; mergeTargetEventId?: string },
  ) {
    setBusyEventId(eventId)
    setError(null)
    try {
      const response = await fetch(buildAvaOperatorPackageMemoryActionsApiPath(packageId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          eventId,
          action,
          correctedConclusion: extra?.correctedConclusion,
          mergeTargetEventId: extra?.mergeTargetEventId,
          idempotencyKey: `${action}:${eventId}:${extra?.correctedConclusion ?? extra?.mergeTargetEventId ?? ""}`,
        }),
      })
      const payload = (await response.json()) as {
        ok?: boolean
        result?: string
        memoryReview?: Approvals2AMemoryReviewRow[]
        message?: string
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? payload.result ?? "Memory action failed.")
      }
      if (payload.memoryReview) {
        setLocalRows(payload.memoryReview)
        onUpdated?.(payload.memoryReview)
      }
      setCorrectingId(null)
      setMergeSourceId(null)
      setMergeTargetId("")
      setCorrectText("")
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Memory action failed.")
    } finally {
      setBusyEventId(null)
    }
  }

  if (!visibleRows.length) return null

  return (
    <GrowthCollapsibleEngineCard
      title="Account memory review"
      subtitle={
        needsAttention
          ? "New or pending memories need operator authority before Ava treats them as facts."
          : "Operator-approved account memory for this lead."
      }
      defaultOpen={needsAttention}
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {visibleRows.map((row) => (
          <div key={row.id} className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{row.humanMemoryKind ?? row.category}</Badge>
              <Badge variant="secondary">{row.confidence}</Badge>
              <Badge variant="outline">{row.operatorStatus}</Badge>
              {row.pinned ? <Badge>Pinned</Badge> : null}
              {row.protected ? <Badge variant="secondary">Protected</Badge> : null}
            </div>
            <p className="text-sm font-medium text-foreground">{row.conclusion}</p>
            <p className="text-xs text-muted-foreground">
              Source: {row.sourceSystem}
              {row.freshnessExpiresAt ? ` · Expires ${new Date(row.freshnessExpiresAt).toLocaleDateString()}` : ""}
            </p>
            {row.whyItMatters ? <p className="text-xs text-muted-foreground">{row.whyItMatters}</p> : null}

            {correctingId === row.id ? (
              <div className="space-y-2">
                <Textarea value={correctText} onChange={(event) => setCorrectText(event.target.value)} rows={3} />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busyEventId === row.id || !correctText.trim()}
                    onClick={() => void submitAction(row.id, "correct", { correctedConclusion: correctText.trim() })}
                  >
                    Save correction
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCorrectingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {mergeSourceId === row.id ? (
              <div className="space-y-2">
                <Input
                  placeholder="Target memory event ID"
                  value={mergeTargetId}
                  onChange={(event) => setMergeTargetId(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busyEventId === row.id || !mergeTargetId.trim()}
                    onClick={() =>
                      void submitAction(row.id, "merge", { mergeTargetEventId: mergeTargetId.trim() })
                    }
                  >
                    Confirm merge
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setMergeSourceId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {correctingId !== row.id && mergeSourceId !== row.id ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busyEventId === row.id} onClick={() => void submitAction(row.id, "approve")}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyEventId === row.id}
                  onClick={() => {
                    setCorrectingId(row.id)
                    setCorrectText(row.conclusion)
                  }}
                >
                  Correct
                </Button>
                <Button size="sm" variant="outline" disabled={busyEventId === row.id} onClick={() => void submitAction(row.id, "pin")}>
                  Pin
                </Button>
                <Button size="sm" variant="outline" disabled={busyEventId === row.id} onClick={() => void submitAction(row.id, "protect")}>
                  Protect
                </Button>
                <Button size="sm" variant="outline" disabled={busyEventId === row.id} onClick={() => setMergeSourceId(row.id)}>
                  Merge
                </Button>
                <Button size="sm" variant="ghost" disabled={busyEventId === row.id} onClick={() => void submitAction(row.id, "delete")}>
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
