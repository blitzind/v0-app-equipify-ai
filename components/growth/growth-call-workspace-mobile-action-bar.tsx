"use client"

import { Phone, PhoneOff, PhoneForwarded, Shield, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { VoiceWorkspaceContextSnapshot } from "@/lib/voice/workspace-context/types"
import { cn } from "@/lib/utils"

export function GrowthCallWorkspaceMobileActionBar({
  workspaceContext,
  onDial,
  onAnswer,
  onEndCall,
  onTransfer,
  onResolve,
  disabled = false,
  className,
}: {
  workspaceContext: VoiceWorkspaceContextSnapshot
  onDial?: () => void
  onAnswer?: () => void
  onEndCall?: () => void
  onTransfer?: () => void
  onResolve?: () => void
  disabled?: boolean
  className?: string
}) {
  const elevated = workspaceContext.contextualActions.filter((action) => action.elevated)
  if (elevated.length === 0 && workspaceContext.mode === "idle") return null

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-3 py-2 backdrop-blur lg:hidden",
        className,
      )}
      data-qa-action="call-workspace-mobile-action-bar"
      data-workspace-mode={workspaceContext.mode}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around gap-2">
        {elevated.some((a) => a.id === "dial") ? (
          <Button type="button" size="sm" onClick={onDial} disabled={disabled}>
            <Phone className="mr-1 size-4" />
            Dial
          </Button>
        ) : null}
        {elevated.some((a) => a.id === "answer") ? (
          <Button type="button" size="sm" onClick={onAnswer} disabled={disabled}>
            <Phone className="mr-1 size-4" />
            Answer
          </Button>
        ) : null}
        {elevated.some((a) => a.id === "transfer") ? (
          <Button type="button" size="sm" variant="outline" onClick={onTransfer} disabled={disabled}>
            <PhoneForwarded className="mr-1 size-4" />
            Transfer
          </Button>
        ) : null}
        {elevated.some((a) => a.id === "compliance_review") ? (
          <Button type="button" size="sm" variant="outline" disabled={disabled}>
            <Shield className="mr-1 size-4" />
            Review
          </Button>
        ) : null}
        {elevated.some((a) => a.id === "takeover") ? (
          <Button type="button" size="sm" variant="outline" disabled={disabled}>
            <Sparkles className="mr-1 size-4" />
            Takeover
          </Button>
        ) : null}
        {elevated.some((a) => a.id === "resolve") ? (
          <Button type="button" size="sm" onClick={onResolve} disabled={disabled}>
            Resolve
          </Button>
        ) : null}
        {workspaceContext.mode === "live_call" || workspaceContext.mode === "escalation" ? (
          <Button type="button" size="sm" variant="destructive" onClick={onEndCall} disabled={disabled}>
            <PhoneOff className="mr-1 size-4" />
            End
          </Button>
        ) : null}
      </div>
    </div>
  )
}
