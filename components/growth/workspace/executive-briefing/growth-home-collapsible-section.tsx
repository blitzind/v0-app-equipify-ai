"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export const GROWTH_HOME_SECTION_COLLAPSE_KEY = "equipify:growth-home:section-collapse/v1" as const

function readCollapseState(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(GROWTH_HOME_SECTION_COLLAPSE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeCollapseState(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GROWTH_HOME_SECTION_COLLAPSE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

type Props = {
  sectionId: string
  title: string
  subtitle?: string | null
  defaultOpen?: boolean
  children: React.ReactNode
}

/**
 * GE-AIOS-7A — Home section wrapper that remembers its expand/collapse state
 * per section in localStorage. Presentation-only; no data loading.
 */
export function GrowthHomeCollapsibleSection({
  sectionId,
  title,
  subtitle = null,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const stored = readCollapseState()
    if (sectionId in stored) setOpen(Boolean(stored[sectionId]))
  }, [sectionId])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    writeCollapseState({ ...readCollapseState(), [sectionId]: next })
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className="rounded-2xl border border-border/60 bg-card/40"
      data-qa-section={`home-collapsible-${sectionId}`}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5">
        <span className="min-w-0">
          <span className="block text-base font-semibold tracking-tight text-foreground">{title}</span>
          {subtitle ? <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "")} aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-5 px-4 pb-5 pt-1 sm:px-5">{children}</CollapsibleContent>
    </Collapsible>
  )
}
