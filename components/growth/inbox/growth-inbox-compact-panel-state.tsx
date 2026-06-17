"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export const GROWTH_INBOX_COMPACT_PANEL_STATE_QA_MARKER = "growth-inbox-compact-panel-state-v1" as const

type GrowthInboxCompactPanelStateProps = {
  title: string
  state: "loading" | "error" | "empty"
  message?: string
  onRetry?: () => void
}

/** Phase 8A.2 — 80–120px operator panel loading/error/empty chrome. */
export function GrowthInboxCompactPanelState({
  title,
  state,
  message,
  onRetry,
}: GrowthInboxCompactPanelStateProps) {
  const body =
    state === "loading"
      ? "Loading…"
      : state === "error"
        ? message ?? "Unavailable."
        : message ?? "No items right now."

  return (
    <div
      className="flex min-h-[5rem] max-h-[7.5rem] flex-col justify-center rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
      data-qa-marker={GROWTH_INBOX_COMPACT_PANEL_STATE_QA_MARKER}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {state === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : null}
        <span>{body}</span>
      </div>
      {state !== "loading" && onRetry ? (
        <Button type="button" variant="outline" size="sm" className="mt-2 h-7 w-fit px-2 text-xs" onClick={onRetry}>
          <RefreshCw className="mr-1 size-3" />
          Retry
        </Button>
      ) : null}
    </div>
  )
}
