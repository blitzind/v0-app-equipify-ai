"use client"

import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  GROWTH_FLOATING_INSET_QA_MARKER,
  GROWTH_STICKY_ACTION_BAR_INNER_LAYOUT,
  GROWTH_STICKY_ACTION_BAR_SURFACE,
} from "@/lib/layout/aiden-safe-area"

type GrowthStickyActionBarProps = Omit<ComponentPropsWithoutRef<"footer">, "children"> & {
  children: ReactNode
  innerClassName?: string
  /** Defaults to `Page actions` when omitted. */
  ariaLabel?: string
}

export function GrowthStickyActionBar({
  children,
  className,
  innerClassName,
  ariaLabel = "Page actions",
  ...props
}: GrowthStickyActionBarProps) {
  return (
    <footer
      className={cn(GROWTH_STICKY_ACTION_BAR_SURFACE, className)}
      aria-label={ariaLabel}
      data-growth-floating-inset={GROWTH_FLOATING_INSET_QA_MARKER}
      {...props}
    >
      <div className={cn(GROWTH_STICKY_ACTION_BAR_INNER_LAYOUT, innerClassName)}>{children}</div>
    </footer>
  )
}
