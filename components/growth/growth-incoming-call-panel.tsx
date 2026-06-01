"use client"

import { useEffect, useRef } from "react"
import { Phone, PhoneOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import { NATIVE_DIALER_PROVIDER_LABELS } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  INBOUND_RING_DIAG_EVENTS,
  logInboundRingDiagnostic,
  withInboundRingElapsed,
} from "@/lib/voice/browser-calling/inbound-ring-diagnostics"

export function GrowthIncomingCallPanel({
  session,
  voiceCallCreatedAt,
  onAnswer,
  onDecline,
  answering,
  declining,
  embedded,
}: {
  session: NativeCallWorkspaceSessionPublicView
  voiceCallCreatedAt?: string | null
  onAnswer: () => void
  onDecline: () => void
  answering?: boolean
  declining?: boolean
  embedded?: boolean
}) {
  const mountedSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (mountedSessionIdRef.current === session.id) return
    mountedSessionIdRef.current = session.id
    logInboundRingDiagnostic(
      INBOUND_RING_DIAG_EVENTS.ANSWER_BUTTON_MOUNTED,
      withInboundRingElapsed(voiceCallCreatedAt ?? null, {
        native_session_id: session.id,
        voice_call_id: session.voiceCallId,
      }),
    )
  }, [session.id, session.voiceCallId, voiceCallCreatedAt])
  const content = (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <GrowthBadge label={session.direction === "inbound" ? "Inbound" : "Outbound ringing"} tone="attention" />
        <GrowthBadge label={NATIVE_DIALER_PROVIDER_LABELS[session.provider]} tone="neutral" />
      </div>

      <div className="mb-6 space-y-1">
        <p className="text-lg font-semibold">{session.companyName ?? "Unknown caller"}</p>
        <p className="text-sm text-muted-foreground">{session.contactName ?? session.phoneNumber ?? "—"}</p>
        <p className="text-sm font-medium tabular-nums">{session.phoneNumber ?? "—"}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="min-w-[120px]" disabled={answering || declining} onClick={onAnswer}>
          <Phone className="mr-2 size-4" />
          {answering ? "Connecting…" : "Answer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-w-[120px]"
          disabled={answering || declining}
          onClick={onDecline}
        >
          <PhoneOff className="mr-2 size-4" />
          {declining ? "Declining…" : "Decline"}
        </Button>
      </div>
    </>
  )

  if (embedded) return <div className="flex flex-1 flex-col">{content}</div>

  return (
    <GrowthEngineCard title="Incoming call" subtitle="Operator must answer — no autonomous pickup">
      {content}
    </GrowthEngineCard>
  )
}
