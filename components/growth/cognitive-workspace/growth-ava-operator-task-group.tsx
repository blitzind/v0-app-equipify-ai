"use client"

import type { ReactNode } from "react"

type GrowthAvaOperatorTaskGroupProps = {
  title: string
  description?: string
  children: ReactNode
}

/**
 * GE-AIOS-25A-2 — Operator-responsibility grouping inside Human Workspace.
 */
export function GrowthAvaOperatorTaskGroup({
  title,
  description,
  children,
}: GrowthAvaOperatorTaskGroupProps) {
  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-background/70 p-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
