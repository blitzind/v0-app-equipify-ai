"use client"

import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { GROWTH_WORKSPACE_PAGE_STACK } from "@/lib/workspace/workspace-shell-tokens"
import {
  GROWTH_FLOATING_INSET_QA_MARKER,
  GROWTH_STICKY_ACTION_BAR_INNER_LAYOUT,
  GROWTH_STICKY_ACTION_BAR_SURFACE,
  GROWTH_WIZARD_ACTION_ROW,
  GROWTH_WORKSPACE_SAFE_AREA,
  GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER,
} from "@/lib/layout/aiden-safe-area"

export const GROWTH_WORKSPACE_PAGE_CONTENT_QA_MARKER = "growth-workspace-page-content-v1" as const

export function GrowthWorkspacePageContent({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(GROWTH_WORKSPACE_PAGE_STACK, className)}
      data-qa-marker={GROWTH_WORKSPACE_PAGE_CONTENT_QA_MARKER}
      {...props}
    >
      {children}
    </div>
  )
}

type GrowthStickyActionBarProps = Omit<ComponentPropsWithoutRef<"footer">, "children"> & {
  children: ReactNode
  innerClassName?: string
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

type GrowthWorkspaceSafeAreaProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode
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

type GrowthWizardActionRowProps = ComponentPropsWithoutRef<"div"> & {
  align?: "between" | "end" | "start"
}

export function GrowthWizardActionRow({ align = "between", className, ...props }: GrowthWizardActionRowProps) {
  return (
    <div
      className={cn(
        GROWTH_WIZARD_ACTION_ROW,
        align === "between" && "justify-between",
        align === "end" && "justify-end",
        align === "start" && "justify-start",
        className,
      )}
      data-growth-floating-inset={GROWTH_FLOATING_INSET_QA_MARKER}
      {...props}
    />
  )
}
