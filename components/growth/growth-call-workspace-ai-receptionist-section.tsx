"use client"

import { useCallback, useState } from "react"
import { Headphones, Loader2, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceAiReceptionistWorkspaceSnapshot } from "@/lib/voice/ai-receptionist/types"
import { VOICE_AI_RECEPTIONIST_QA_MARKER } from "@/lib/voice/ai-receptionist/types"
import { cn } from "@/lib/utils"

function formatPhase(phase: string): string {
  return phase.replace(/_/g, " ")
}

export function GrowthCallWorkspaceAiReceptionistSection({
  aiReceptionist,
  voiceCallId,
  onSnapshotRefresh,
}: {
  aiReceptionist: VoiceAiReceptionistWorkspaceSnapshot | null
  voiceCallId: string | null
  onSnapshotRefresh?: () => Promise<void>
}) {
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const session = aiReceptionist?.session ?? null
  const canTakeover =
    Boolean(voiceCallId) &&
    Boolean(session) &&
    session?.receptionistStatus !== "operator_joined" &&
    session?.receptionistStatus !== "completed"

  const handleTakeover = useCallback(async () => {
    if (!voiceCallId) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/voice/calls/${voiceCallId}/ai-receptionist/takeover`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        setError(data.message ?? "Takeover failed.")
        return
      }
      await onSnapshotRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Takeover failed.")
    } finally {
      setActing(false)
    }
  }, [onSnapshotRefresh, voiceCallId])

  if (!aiReceptionist) return null

  return (
    <section
      className="rounded-xl border border-emerald-200/70 bg-emerald-50/20 px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      data-voice-ai-receptionist-qa-marker={VOICE_AI_RECEPTIONIST_QA_MARKER}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Headphones className="size-4 text-emerald-700 dark:text-emerald-300" />
        <p className="text-sm font-semibold">AI Inbound Receptionist</p>
        <GrowthBadge label="Bounded · supervised" tone="neutral" />
        <GrowthBadge label="No autonomous outbound" tone="neutral" />
      </div>

      {session ? (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            <GrowthBadge label={formatPhase(session.receptionistStatus)} tone="healthy" />
            <GrowthBadge label={`Phase: ${formatPhase(session.currentConversationPhase)}`} tone="neutral" />
            <GrowthBadge label={`Escalation: ${session.escalationRiskLevel}`} tone="neutral" />
            {aiReceptionist.currentIntent ? (
              <GrowthBadge label={`Intent: ${formatPhase(aiReceptionist.currentIntent)}`} tone="neutral" />
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            Qualification: {aiReceptionist.qualificationProgress.completed}/
            {aiReceptionist.qualificationProgress.total}
            {aiReceptionist.qualificationProgress.currentStep
              ? ` · current: ${aiReceptionist.qualificationProgress.currentStep}`
              : ""}
          </p>

          {session.handoffSummaryDraft ? (
            <div className="mt-2 rounded-md border border-emerald-200/50 bg-emerald-50/40 px-2 py-1.5 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <span className="font-medium">Handoff summary:</span> {session.handoffSummaryDraft}
            </div>
          ) : null}

          {aiReceptionist.recentEvents.length > 0 ? (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px] text-muted-foreground">
              {aiReceptionist.recentEvents.slice(0, 6).map((event) => (
                <li key={event.id} className="truncate">
                  {formatPhase(event.eventType)} — {event.evidenceText}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{aiReceptionist.message}</p>
      )}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {canTakeover ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={acting}
            data-qa-action="ai-receptionist-takeover"
            onClick={() => void handleTakeover()}
          >
            {acting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Taking over…
              </>
            ) : (
              <>
                <UserCheck className="mr-1.5 size-3.5" />
                Operator takeover
              </>
            )}
          </Button>
        ) : null}
      </div>

      <p className={cn("mt-2 text-[10px] text-muted-foreground")}>{aiReceptionist.message}</p>
    </section>
  )
}
