"use client"

import { useCallback, useState } from "react"
import { Check, Loader2, PhoneMissed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceMissedCallRecoveryWorkspaceSnapshot } from "@/lib/voice/missed-call-recovery/types"
import { VOICE_MISSED_CALL_RECOVERY_QA_MARKER } from "@/lib/voice/missed-call-recovery/types"

function formatType(type: string): string {
  return type.replace(/_/g, " ")
}

export function GrowthCallWorkspaceMissedCallRecoverySection({
  missedCallRecovery,
  onSnapshotRefresh,
}: {
  missedCallRecovery: VoiceMissedCallRecoveryWorkspaceSnapshot | null
  onSnapshotRefresh?: () => Promise<void>
}) {
  const [acting, setActing] = useState<string | null>(null)

  const handleAcknowledge = useCallback(
    async (recoveryId: string) => {
      setActing(recoveryId)
      try {
        await fetch(`/api/platform/growth/voice/missed-call-recovery/${recoveryId}/acknowledge`, { method: "POST" })
        await onSnapshotRefresh?.()
      } finally {
        setActing(null)
      }
    },
    [onSnapshotRefresh],
  )

  if (!missedCallRecovery) return null
  if (missedCallRecovery.activeRecoveries.length === 0 && missedCallRecovery.callbackTasks.length === 0) {
    return null
  }

  return (
    <section
      className="rounded-xl border border-amber-200/70 bg-amber-50/20 px-3 py-3 dark:border-amber-900/40 dark:bg-amber-950/20"
      data-voice-missed-call-recovery-qa-marker={VOICE_MISSED_CALL_RECOVERY_QA_MARKER}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <PhoneMissed className="size-4 text-amber-700 dark:text-amber-300" />
        <p className="text-sm font-semibold">Missed-Call Recovery</p>
        <GrowthBadge label="Operator callback only" tone="neutral" />
        <GrowthBadge label="No auto-dial" tone="neutral" />
      </div>

      {missedCallRecovery.activeRecoveries.map((recovery) => (
        <div key={recovery.id} className="mb-2 rounded-md border border-amber-200/50 bg-amber-50/30 px-2 py-2 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="mb-1 flex flex-wrap gap-2">
            <GrowthBadge label={formatType(recovery.recoveryType)} tone="healthy" />
            <GrowthBadge label={recovery.recommendedAction.replace(/_/g, " ")} tone="neutral" />
          </div>
          <p className="text-muted-foreground">{recovery.evidenceText}</p>
          {recovery.recoveryStatus === "active" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={acting != null}
              data-qa-action="missed-call-recovery-acknowledge"
              onClick={() => void handleAcknowledge(recovery.id)}
            >
              {acting === recovery.id ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 size-3.5" />
              )}
              Acknowledge
            </Button>
          ) : null}
        </div>
      ))}

      {missedCallRecovery.callbackTasks.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          {missedCallRecovery.callbackTasks.slice(0, 4).map((task) => (
            <li key={task.id} className="truncate">
              Callback · {task.phoneNumber} · {task.priority}
              {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleString()}` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-[10px] text-muted-foreground">{missedCallRecovery.message}</p>
    </section>
  )
}
