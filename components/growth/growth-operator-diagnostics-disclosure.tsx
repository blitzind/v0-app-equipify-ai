"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { GROWTH_OPERATOR_DIAGNOSTICS_DISCLOSURE_QA_MARKER } from "@/lib/growth/operator-ux/operator-ux-h3-types"
import { cn } from "@/lib/utils"

export function GrowthOperatorDiagnosticsDisclosure({
  title = "Advanced diagnostics",
  description = "Engineering telemetry, cron health, and infrastructure readiness.",
  defaultOpen = false,
  children,
  className,
}: {
  title?: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={cn("rounded-xl border border-dashed border-border/80 bg-muted/10", className)}
      data-qa={GROWTH_OPERATOR_DIAGNOSTICS_DISCLOSURE_QA_MARKER}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="space-y-4 border-t border-border/60 px-4 pb-4 pt-3">{children}</div> : null}
    </div>
  )
}
