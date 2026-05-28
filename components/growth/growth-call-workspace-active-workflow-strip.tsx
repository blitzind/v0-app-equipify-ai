"use client"

import { AlertTriangle, Bot, Clock, Shield, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { growthBadgeToneForPriority, priorityLabel } from "@/lib/voice/workspace-context/visual-priority"
import type { VoiceWorkspaceActiveWorkflowItem, VoiceWorkspaceContextSnapshot } from "@/lib/voice/workspace-context/types"
import { cn } from "@/lib/utils"

function workflowIcon(type: string) {
  if (type.includes("escalation")) return AlertTriangle
  if (type.includes("ai")) return Bot
  if (type.includes("compliance")) return Shield
  if (type.includes("callback")) return Clock
  return Sparkles
}

function WorkflowChip({
  item,
  onOpen,
}: {
  item: VoiceWorkspaceActiveWorkflowItem
  onOpen?: (item: VoiceWorkspaceActiveWorkflowItem) => void
}) {
  const Icon = workflowIcon(item.workflowType)
  return (
    <div
      className="flex min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 dark:border-white/10"
      data-workflow-type={item.workflowType}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{item.label}</p>
        <p className="truncate text-[10px] text-muted-foreground">{item.statusLabel}</p>
      </div>
      <GrowthBadge label={priorityLabel(item.priority)} tone={growthBadgeToneForPriority(item.priority)} />
      {onOpen ? (
        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => onOpen(item)}>
          Open
        </Button>
      ) : null}
    </div>
  )
}

export function GrowthCallWorkspaceActiveWorkflowStrip({
  workspaceContext,
  onOpenWorkflow,
  className,
}: {
  workspaceContext: VoiceWorkspaceContextSnapshot
  onOpenWorkflow?: (item: VoiceWorkspaceActiveWorkflowItem) => void
  className?: string
}) {
  const items = workspaceContext.activeWorkflowItems
  if (items.length === 0) return null

  return (
    <section
      className={cn(
        "rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5 dark:border-white/10",
        className,
      )}
      data-qa-action="call-workspace-active-workflow-strip"
      data-workspace-mode={workspaceContext.mode}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active workflows</p>
        <GrowthBadge label={String(items.length)} tone="medium" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <div key={item.id} className="w-[min(100%,220px)] shrink-0">
            <WorkflowChip item={item} onOpen={onOpenWorkflow} />
          </div>
        ))}
      </div>
    </section>
  )
}
