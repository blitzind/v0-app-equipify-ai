"use client"

import { Loader2, Phone, SkipForward, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_CALL_WORKSPACE_OPS_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-operator-types"
import type { QueuePreviewState } from "@/lib/growth/native-dialer/call-workspace-operator-types"
import { formatDisplayPhone } from "@/lib/growth/native-dialer/native-dialer-workspace-ui"

export function GrowthCallWorkspaceQueuePreviewPanel({
  preview,
  autoDialSeconds,
  loading,
  onCall,
  onSkip,
  onSnooze,
  onNext,
}: {
  preview: QueuePreviewState
  autoDialSeconds?: number | null
  loading?: boolean
  onCall: () => void
  onSkip: () => void
  onSnooze: () => void
  onNext: () => void
}) {
  return (
    <section
      className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 dark:border-emerald-400/20"
      data-growth-call-workspace-ops-marker={GROWTH_CALL_WORKSPACE_OPS_QA_MARKER}
      data-qa-action="call-workspace-queue-preview"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Queue preview
          </p>
          <h3 className="text-lg font-semibold">{preview.company ?? "Lead"}</h3>
          <p className="text-sm text-muted-foreground">
            {preview.contact ?? "Contact"} · {formatDisplayPhone(preview.phone ?? "")}
          </p>
        </div>
        {preview.queueMode ? <GrowthBadge label={preview.queueMode.replace(/_/g, " ")} tone="healthy" /> : null}
      </div>

      {preview.reason ? <p className="mb-3 text-sm text-muted-foreground">{preview.reason}</p> : null}

      {autoDialSeconds != null && autoDialSeconds > 0 ? (
        <p className="mb-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <Timer className="size-4" />
          Auto-dial in {autoDialSeconds}s
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onCall} disabled={loading}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Phone className="mr-2 size-4" />}
          Call
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onSkip} disabled={loading}>
          <SkipForward className="mr-2 size-4" />
          Skip
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onSnooze} disabled={loading}>
          Snooze
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onNext} disabled={loading}>
          Next
        </Button>
      </div>
    </section>
  )
}
