"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GrowthInboxLazyMount } from "@/components/growth/inbox/growth-inbox-lazy-mount"
import { cn } from "@/lib/utils"

export const GROWTH_INBOX_EXPANDABLE_LAZY_PANEL_QA_MARKER = "growth-inbox-expandable-lazy-panel-v1" as const

/** Operations/workflow panels fetch only after operator expands the section. */
export function GrowthInboxExpandableLazyPanel({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [activated, setActivated] = useState(defaultOpen)

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setActivated(true)
      }}
      className="rounded-xl border border-border bg-card shadow-sm"
      data-qa-marker={GROWTH_INBOX_EXPANDABLE_LAZY_PANEL_QA_MARKER}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open ? "rotate-180" : "")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border px-4 py-4">
        <GrowthInboxLazyMount enabled={activated}>{children}</GrowthInboxLazyMount>
      </CollapsibleContent>
    </Collapsible>
  )
}
