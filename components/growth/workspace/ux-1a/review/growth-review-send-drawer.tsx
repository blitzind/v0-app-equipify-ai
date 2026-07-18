"use client"

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { GrowthSequenceExecutionJobView } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { channelTypeLabel } from "@/lib/growth/multichannel/multichannel-types"
import { mapReviewSendStatusLabel } from "@/lib/growth/workspace/ux-1a/review/growth-review-decision-queue-synthesizer"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: GrowthSequenceExecutionJobView | null
  soloApprovalEnabled: boolean
  onCompleted: () => void
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function GrowthReviewSendDrawer({
  open,
  onOpenChange,
  job,
  soloApprovalEnabled,
  onCompleted,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const messageBody = useMemo(() => {
    if (!job) return ""
    if (job.channel === "sms" && job.smsDraftBody?.trim()) return job.smsDraftBody.trim()
    return "Full message preview will appear here once the draft is ready."
  }, [job])

  async function runAction(action: "approve" | "skip") {
    if (!job) return
    if (action === "skip") {
      const confirmed = window.confirm(
        "Mark this send as needs work? It will be skipped and can be restored later if needed.",
      )
      if (!confirmed) return
    }

    setBusy(true)
    setError(null)
    setConfirmation(null)
    try {
      const response = await fetch(
        `/api/platform/growth/sequences/execution/jobs/${encodeURIComponent(job.id)}/${action === "approve" ? "approve" : "skip"}`,
        { method: "POST" },
      )
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
      if (!response.ok || body.ok === false) {
        throw new Error(body.message ?? body.error ?? "Action failed.")
      }
      setConfirmation(action === "approve" ? "Send authorized. Nothing has been delivered yet." : "Send marked as needs work.")
      onCompleted()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.")
    } finally {
      setBusy(false)
    }
  }

  if (!job) return null

  const canApprove = job.status === "pending_approval" && !job.apolloDraftApprovalBlocked

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-xl"
        data-section="review-send-drawer"
        aria-describedby="review-send-drawer-description"
      >
        <SheetHeader>
          <SheetTitle>Review send</SheetTitle>
          <SheetDescription id="review-send-drawer-description">
            Nothing has been sent yet. Authorize only when you are ready for this message to be queued.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{mapReviewSendStatusLabel(job.status)}</Badge>
              <Badge variant="outline">{channelTypeLabel(job.channel)}</Badge>
            </div>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Recipient</dt>
                <dd className="font-medium text-foreground">{job.leadLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Subject / preview</dt>
                <dd>{job.stepLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Queued</dt>
                <dd>{formatWhen(job.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Safety status</dt>
                <dd>
                  {job.apolloDraftApprovalBlocked
                    ? "Needs attention before this can be authorized"
                    : "Waiting for your approval"}
                </dd>
              </div>
            </dl>
          </div>

          <section aria-labelledby="review-send-body-heading" className="space-y-2">
            <h3 id="review-send-body-heading" className="text-sm font-semibold">
              Message
            </h3>
            <div className="rounded-xl border border-border/70 bg-background p-4 text-sm whitespace-pre-wrap">
              {messageBody}
            </div>
          </section>

          {confirmation ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-950">
              {confirmation}
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            {canApprove ? (
              <Button type="button" disabled={busy} onClick={() => void runAction("approve")}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {soloApprovalEnabled ? "Authorize send" : "Authorize"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={busy || job.status !== "pending_approval"}
              onClick={() => void runAction("skip")}
            >
              Needs work
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
