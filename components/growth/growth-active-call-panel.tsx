"use client"

import { useEffect, useState } from "react"
import { Mic, MicOff, Pause, PhoneOff, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import { NATIVE_DIALER_PROVIDER_LABELS } from "@/lib/growth/native-dialer/native-dialer-types"

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function GrowthActiveCallPanel({
  session,
  onEndCall,
  onNotesChange,
  ending,
  embedded,
}: {
  session: NativeCallWorkspaceSessionPublicView
  onEndCall: () => void
  onNotesChange: (notes: string) => void
  ending?: boolean
  embedded?: boolean
}) {
  const [elapsed, setElapsed] = useState(session.durationSeconds)

  useEffect(() => {
    if (session.status !== "active" && session.status !== "on_hold") return
    const anchor = session.connectedAt ? Date.parse(session.connectedAt) : Date.parse(session.startedAt)
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - anchor) / 1000)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [session.connectedAt, session.startedAt, session.status])

  const content = (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <GrowthBadge label={session.status} tone="healthy" />
        <GrowthBadge label={NATIVE_DIALER_PROVIDER_LABELS[session.provider]} tone="neutral" />
        <GrowthBadge label={`Timer ${formatDuration(elapsed)}`} tone="medium" />
        <GrowthBadge label={`Recording ${session.recordingState}`} tone="neutral" />
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Prospect</p>
          <p className="text-sm font-medium">{session.companyName ?? "Unknown"}</p>
          <p className="text-sm text-muted-foreground">{session.contactName ?? session.phoneNumber}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Number</p>
          <p className="text-sm font-medium">{session.phoneNumber ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{session.safeSummary}</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-dashed border-border/80 p-3 text-sm text-muted-foreground">
        Live Coaching, realtime objections, suggestions, risk, and sentiment render in the lead drawer panels
        when linked to this session. Operator controlled only.
      </div>

      <Textarea
        placeholder="Call notes (operator)"
        value={session.notesDraft}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={3}
      />

      {!embedded ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled>
            {session.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            Mute
          </Button>
          <Button type="button" size="sm" variant="outline" disabled>
            <Pause className="size-4" />
            Hold
          </Button>
          <Button type="button" size="sm" variant="outline" disabled>
            Transfer
          </Button>
          <Button type="button" size="sm" variant="outline" disabled>
            <Square className="size-4" />
            Keypad
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={ending} onClick={onEndCall}>
            <PhoneOff className="mr-2 size-4" />
            {ending ? "Ending…" : "End call"}
          </Button>
        </div>
      ) : null}
    </>
  )

  if (embedded) return <div className="flex flex-1 flex-col overflow-auto">{content}</div>

  return (
    <GrowthEngineCard title="Active call" subtitle="Live coaching + operator controls — no autonomous actions">
      {content}
    </GrowthEngineCard>
  )
}
