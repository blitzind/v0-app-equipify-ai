"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { DRAWER_NESTED_CARD } from "@/components/detail-drawer"
import { GROWTH_DRAWER_CARD_PERSIST_PREFIX } from "@/lib/growth/growth-lead-drawer-stream-filters"
import { cn } from "@/lib/utils"

type GrowthCognitiveSectionProps = {
  id: string
  title: string
  children: ReactNode
  defaultOpen?: boolean
  persistKey?: string
  expandToken?: number
  className?: string
  headerAside?: ReactNode
  forceVisible?: boolean
}

export function GrowthCognitiveSection({
  id,
  title,
  children,
  defaultOpen = true,
  persistKey,
  expandToken = 0,
  className,
  headerAside,
  forceVisible = false,
}: GrowthCognitiveSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!persistKey) return
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
    if (persistKey) {
      try {
        localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${persistKey}`, "true")
      } catch {
        // ignore
      }
    }
  }, [expandToken, persistKey])

  function toggleOpen() {
    setOpen((value) => {
      const next = !value
      if (persistKey) {
        try {
          localStorage.setItem(`${GROWTH_DRAWER_CARD_PERSIST_PREFIX}${persistKey}`, String(next))
        } catch {
          // ignore
        }
      }
      return next
    })
  }

  return (
    <section
      id={id}
      data-cognitive-section={id}
      className={cn(DRAWER_NESTED_CARD, "p-4 sm:p-5", className)}
      data-force-visible={forceVisible ? "true" : undefined}
    >
      <button type="button" className="flex w-full items-center gap-2 text-left" onClick={toggleOpen} aria-expanded={open}>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {headerAside ? <div className="ml-auto flex shrink-0 items-center gap-2">{headerAside}</div> : null}
      </button>
      {open ? <div className="mt-4 space-y-3">{children}</div> : null}
    </section>
  )
}
