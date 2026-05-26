"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, Headphones, PhoneOff, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  copyPhoneNumberToClipboard,
  GOOGLE_VOICE_BRIDGE_QA_MARKER,
  openGoogleVoiceBridgeTab,
} from "@/lib/growth/native-dialer/native-dialer-bridge"
import {
  formatDisplayPhone,
  GROWTH_CALL_WORKSPACE_PANEL,
} from "@/lib/growth/native-dialer/native-dialer-workspace-ui"
import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import { cn } from "@/lib/utils"

export function GrowthCallWorkspaceGoogleVoiceBridgePanel({
  session,
  markingStarted,
  ending,
  onMarkCallStarted,
  onStartLiveCoaching,
  onEndCall,
}: {
  session: NativeCallWorkspaceSessionPublicView
  markingStarted?: boolean
  ending?: boolean
  onMarkCallStarted: () => void
  onStartLiveCoaching: () => void
  onEndCall: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopyPhone() {
    const ok = await copyPhoneNumberToClipboard(session.phoneNumber)
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(GROWTH_CALL_WORKSPACE_PANEL, "flex flex-col gap-4 border-amber-500/30 bg-amber-500/5 p-5 dark:border-amber-400/20")}
      data-qa-marker={GOOGLE_VOICE_BRIDGE_QA_MARKER}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <GrowthBadge label="External Bridge Mode" tone="attention" />
          <h3 className="mt-2 text-lg font-semibold">Google Voice Bridge</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Place the call in Google Voice, then click <span className="font-medium text-foreground">Mark Call Started</span>.
          </p>
        </div>
        <GrowthBadge label="Manual provider telemetry unavailable" tone="neutral" />
      </div>

      <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 dark:border-white/10">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Dial target</p>
        <p className="mt-1 font-semibold">{session.companyName ?? session.contactName ?? "Prospect"}</p>
        <p className="text-sm text-muted-foreground">
          {formatDisplayPhone(session.phoneNumber)} · {session.contactName ?? "Contact"}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Live Coaching is available through browser capture. Call intelligence is generated only when Live Coaching or
        session capture is active.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={() => openGoogleVoiceBridgeTab()}>
          <ExternalLink className="mr-2 size-4" />
          Open Google Voice
        </Button>
        <Button type="button" variant="outline" onClick={() => void handleCopyPhone()}>
          {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
          {copied ? "Copied" : "Copy Phone Number"}
        </Button>
        <Button type="button" onClick={onMarkCallStarted} disabled={markingStarted}>
          <Radio className="mr-2 size-4" />
          {markingStarted ? "Starting…" : "Mark Call Started"}
        </Button>
        <Button type="button" variant="secondary" onClick={onStartLiveCoaching}>
          <Headphones className="mr-2 size-4" />
          Start Live Coaching
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="sm:col-span-2"
          onClick={onEndCall}
          disabled={ending}
        >
          <PhoneOff className="mr-2 size-4" />
          {ending ? "Ending…" : "End / Wrap Up"}
        </Button>
      </div>
    </div>
  )
}
