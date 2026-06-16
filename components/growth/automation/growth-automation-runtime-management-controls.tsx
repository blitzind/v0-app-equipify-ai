"use client"

import { useState } from "react"
import { Ban, Loader2, PauseCircle, PlayCircle, ShieldAlert, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS,
  type GrowthAutomationRuntimeKillSwitchState,
} from "@/lib/growth/automation/growth-automation-observability-types"

type Props = {
  flowId: string
  enrollmentId?: string | null
  leadId?: string | null
  killSwitch: GrowthAutomationRuntimeKillSwitchState | null
  canPause?: boolean
  canResume?: boolean
  onChanged?: () => void
}

export function GrowthAutomationRuntimeManagementControls({
  flowId,
  enrollmentId,
  leadId,
  killSwitch,
  canPause = true,
  canResume = true,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const run = async (action: string, path: string, body?: Record<string, unknown>) => {
    setBusy(action)
    setMessage(null)
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      })
      const data = (await res.json()) as { ok?: boolean; management?: { detail?: string } }
      setMessage(data.management?.detail ?? (data.ok ? `${action} completed.` : `${action} failed.`))
      onChanged?.()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.management_controls_enabled ? (
          <span>management enabled</span>
        ) : null}
        {GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.message_send_execution_enabled === false ? (
          <span>no sends</span>
        ) : null}
        {killSwitch?.enabled ? <span>kill switch on</span> : null}
      </div>

      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Optional management note"
        className="text-xs"
      />

      <div className="flex flex-wrap gap-2">
        {canPause ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void run("pause", `/api/platform/growth/automation/${flowId}/pause`)}
          >
            {busy === "pause" ? <Loader2 className="size-4 animate-spin" /> : <PauseCircle className="size-4" />}
            Pause runtime
          </Button>
        ) : null}
        {canResume ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void run("resume", `/api/platform/growth/automation/${flowId}/runtime/resume`, {
                clearKillSwitch: true,
              })
            }
          >
            {busy === "resume" ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
            Resume runtime
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() =>
            void run("kill-switch", `/api/platform/growth/automation/${flowId}/runtime/kill-switch`, {
              enabled: !killSwitch?.enabled,
              reason: reason.trim() || null,
            })
          }
        >
          {busy === "kill-switch" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : killSwitch?.enabled ? (
            <ShieldAlert className="size-4" />
          ) : (
            <Ban className="size-4" />
          )}
          {killSwitch?.enabled ? "Disable kill switch" : "Enable kill switch"}
        </Button>
        {enrollmentId && leadId ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() =>
              void run(
                "cancel-safe",
                `/api/platform/growth/automation/${flowId}/runtime/enrollments/${encodeURIComponent(enrollmentId)}/cancel-safe`,
                { leadId, reason: reason.trim() || null },
              )
            }
          >
            {busy === "cancel-safe" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            Safe cancel enrollment
          </Button>
        ) : null}
      </div>

      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
