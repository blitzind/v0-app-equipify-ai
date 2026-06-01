"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function GrowthCallWorkspaceCollapsiblePanel({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
  qaAction,
}: {
  title: string
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
  qaAction?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn("rounded-xl border border-border/60 bg-muted/10 dark:border-white/5", className)}>
      <div className="flex items-start justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          {summary && !open ? (
            <p className="mt-0.5 truncate text-sm text-foreground/80">{summary}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2"
          data-qa-action={qaAction}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <>
              <ChevronUp className="mr-1 size-3.5" />
              Hide
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 size-3.5" />
              Show
            </>
          )}
        </Button>
      </div>
      {open ? <div className="border-t border-border/50 px-3 py-3 dark:border-white/5">{children}</div> : null}
    </div>
  )
}
