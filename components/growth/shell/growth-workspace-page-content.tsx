"use client"

import type { ComponentPropsWithoutRef } from "react"
import { cn } from "@/lib/utils"
import { GROWTH_WORKSPACE_PAGE_CONTENT_QA_MARKER } from "@/lib/layout/aiden-safe-area"
import { GROWTH_WORKSPACE_PAGE_STACK } from "@/lib/workspace/workspace-shell-tokens"

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
