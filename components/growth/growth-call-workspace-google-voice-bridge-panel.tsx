"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, Headphones, PhoneOff, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  copyPhoneNumberToClipboard,
  GOOGLE_VOICE_BRIDGE_MANUAL_FLOW_INSTRUCTION,
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
  const displayPhone = formatDisplayPhone(session.phoneNumber)

  async function handleCopyPhone() {
    const ok = await copyPhoneNumberToClipboard(session.phoneNumber)
    setCopied(ok)
    if (ok) window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        GROWTH_CALL_WORKSPACE_PANEL,
        "flex flex-col gap-4 border-amber-500/30 bg-amber-500/5 p-5 dark:border-amber-400/20",
      )}
      data-qa-marker={GOOGLE_VOICE_BRIDGE_QA_MARKER}
    >
      <div>
        <GrowthBadge label="External Bridge Mode" tone="attention" />
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {GOOGLE_VOICE_BRIDGE_MANUAL_FLOW_INSTRUCTION}
        </p>
      </div>

      <button
        type="button"
        data-qa-action="google-voice-bridge-copy-number"
        onClick={() => void handleCopyPhone()}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-full border border-border/70 bg-background px-5 py-4 text-left shadow-sm transition-colors",
          "hover:border-amber-500/40 hover:bg-amber-500/5 dark:border-white/10 dark:bg-white/5",
        )}
      >
        <span className="min-w-0">
          <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Number to dial</span>
          <span className="mt-1 block truncate font-mono text-2xl font-semibold tabular-nums tracking-tight">
            {displayPhone}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Tap to copy"}
        </span>
      </button>

      {(session.companyName ?? session.contactName) ? (
        <p className="text-sm text-muted-foreground">
          {session.companyName ?? session.contactName}
          {session.contactName && session.companyName ? ` · ${session.contactName}` : null}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={() => openGoogleVoiceBridgeTab()}>
          <ExternalLink className="mr-2 size-4" />
          Open Google Voice
        </Button>
        <Button type="button" variant="outline" onClick={() => void handleCopyPhone()}>
          {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
          {copied ? "Copied" : "Copy Number"}
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
