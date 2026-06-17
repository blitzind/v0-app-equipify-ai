"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { WORKSPACE_SHELL_MAIN_INNER, WORKSPACE_SHELL_QA_MARKER } from "@/lib/workspace/workspace-shell-tokens"

type WorkspaceContainerProps = {
  children: ReactNode
  className?: string
  as?: "div" | "main"
  id?: string
}

export function WorkspaceContainer({
  children,
  className,
  as: Component = "div",
  id,
}: WorkspaceContainerProps) {
  return (
    <Component
      id={id}
      className={cn(WORKSPACE_SHELL_MAIN_INNER, className)}
      data-qa-marker={WORKSPACE_SHELL_QA_MARKER}
    >
      {children}
    </Component>
  )
}
