"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { GROWTH_DRAWER_CARD_PERSIST_PREFIX } from "@/lib/growth/growth-lead-drawer-stream-filters"
import { cn } from "@/lib/utils"

type GrowthAvaRawDomainProps = {
  id: string
  title: string
  children: ReactNode
  defaultOpen?: boolean
  persistKey: string
  expandToken?: number
  summary?: string
}

/**
 * GE-AIOS-25A-2 — Nested Raw Intelligence domain (presentation grouping only).
 */
export function GrowthAvaRawDomain({
  id,
  title,
  children,
  defaultOpen = false,
  persistKey,
  expandToken = 0,
  summary,
}: GrowthAvaRawDomainProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${persistKey}`)
      if (stored === "true" || stored === "false") setOpen(stored === "true")
    } catch {
      // ignore
    }
  }, [persistKey])

  useEffect(() => {
    if (!expandToken) return
    setOpen(true)
    try {
      localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${persistKey}`, "true")
    } catch {
      // ignore
    }
  }, [expandToken, persistKey])

  function toggleOpen() {
    setOpen((value) => {
      const next = !value
      try {
        localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${persistKey}`, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <div
      id={id}
      data-ava-raw-domain={id}
      className="rounded-lg border border-border/60 bg-muted/10"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={toggleOpen}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground">{title}</span>
        {summary && !open ? (
          <span className={cn("ml-auto truncate text-[11px] text-muted-foreground")}>{summary}</span>
        ) : null}
      </button>
      {open ? <div className="space-y-3 border-t border-border/50 px-3 py-3">{children}</div> : null}
    </div>
  )
}
