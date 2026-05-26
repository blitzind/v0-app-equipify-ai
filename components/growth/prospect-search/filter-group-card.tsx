"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function FilterGroupCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-gradient-to-b from-card to-muted/20 p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
