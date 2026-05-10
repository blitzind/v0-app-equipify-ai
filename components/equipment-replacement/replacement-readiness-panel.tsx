"use client"

import { cn } from "@/lib/utils"
import type { ReplacementReadinessResult } from "@/lib/equipment-replacement/types"
import { REPLACEMENT_DISCLAIMER, formatReplacementReadinessLabel } from "@/lib/equipment-replacement/eval"
import { ReplacementReadinessBadge } from "@/components/equipment-replacement/replacement-readiness-badge"
import { RefreshCw } from "lucide-react"

export function ReplacementReadinessPanel({
  result,
  className,
  variant = "card",
}: {
  result: ReplacementReadinessResult
  className?: string
  /** `card` = bordered panel; `inline` = compact block for drawers. */
  variant?: "card" | "inline"
}) {
  const wrap = variant === "card" ? "rounded-lg border border-border bg-card/60 p-4 space-y-3" : "space-y-2"

  return (
    <div className={cn(wrap, className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Replacement readiness
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Risk score {result.riskScore}/100 · Data quality: {result.dataQuality}
            </p>
          </div>
        </div>
        <ReplacementReadinessBadge label={result.label} className="shrink-0" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{formatReplacementReadinessLabel(result.label)}</p>
        <ul className="mt-2 text-xs text-muted-foreground space-y-1 list-disc pl-4">
          {result.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug border-t border-border pt-2">{REPLACEMENT_DISCLAIMER}</p>
    </div>
  )
}
