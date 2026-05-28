"use client"

import { useEffect, useMemo, useRef } from "react"
import { Radio, Wifi, WifiOff } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import { VOICE_MEDIA_STREAMING_QA_MARKER } from "@/lib/voice/media-streaming/types"
import { cn } from "@/lib/utils"

function connectionStatusLabel(status: VoiceCallTranscriptSnapshot["connectionStatus"]): string {
  switch (status) {
    case "connected":
      return "Connected"
    case "connecting":
      return "Connecting"
    case "reconnecting":
      return "Reconnecting"
    case "disconnected":
      return "Disconnected"
    case "unavailable":
      return "Unavailable"
    default:
      return status
  }
}

export function GrowthCallWorkspaceLiveTranscriptPanel({
  transcript,
  className,
}: {
  transcript: VoiceCallTranscriptSnapshot | null
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const segments = transcript?.segments ?? []
  const status = transcript?.connectionStatus ?? "unavailable"

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [segments.length, transcript?.lastSequenceNumber])

  const statusTone = useMemo(() => {
    if (status === "connected") return "healthy"
    if (status === "connecting" || status === "reconnecting") return "attention"
    return "neutral"
  }, [status])

  return (
    <div className={cn("rounded-xl border border-border/60 bg-muted/10 dark:border-white/5", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2 dark:border-white/5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Radio className="size-3.5" />
          Live transcript
        </div>
        <div className="flex items-center gap-2">
          <GrowthBadge tone={statusTone}>{connectionStatusLabel(status)}</GrowthBadge>
          {transcript?.transcriptDelayMs != null ? (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              delay {transcript.transcriptDelayMs}ms
            </span>
          ) : null}
        </div>
      </div>

      <div ref={scrollRef} className="max-h-48 space-y-2 overflow-y-auto px-3 py-2 text-sm">
        {segments.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {status === "unavailable"
              ? "Transcript infrastructure unavailable until a media stream session starts."
              : "Waiting for transcript segments… partial gaps are normal during reconnects."}
          </p>
        ) : (
          segments.map((segment) => (
            <div key={segment.id} className="rounded-md bg-background/60 px-2 py-1.5 dark:bg-white/5">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-primary">{segment.speakerLabel}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">#{segment.sequenceNumber}</span>
              </div>
              <p className="text-sm leading-snug">{segment.transcriptText}</p>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground dark:border-white/5">
        <span className="inline-flex items-center gap-1">
          {status === "connected" || status === "connecting" || status === "reconnecting" ? (
            <Wifi className="size-3" />
          ) : (
            <WifiOff className="size-3" />
          )}
          {VOICE_MEDIA_STREAMING_QA_MARKER}
        </span>
        <span>{segments.length} segments</span>
      </div>
    </div>
  )
}
