"use client"

import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  GROWTH_FLOATING_INSET_QA_MARKER,
  GROWTH_WORKSPACE_SAFE_AREA,
  GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER,
} from "@/lib/layout/aiden-safe-area"

type GrowthWorkspaceSafeAreaProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode
  /** `sticky-footer` reserves space for a fixed action bar; `scroll` clears AIden on long pages. */
  variant?: "scroll" | "sticky-footer"
}

export function GrowthWorkspaceSafeArea({
  children,
  className,
  variant = "scroll",
  ...props
}: GrowthWorkspaceSafeAreaProps) {
  return (
    <div
      className={cn(
        variant === "sticky-footer" ? GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER : GROWTH_WORKSPACE_SAFE_AREA,
        className,
      )}
      data-growth-floating-inset={GROWTH_FLOATING_INSET_QA_MARKER}
      {...props}
    >
      {children}
    </div>
  )
}
