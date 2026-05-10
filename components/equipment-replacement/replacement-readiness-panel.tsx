"use client"

import { cn } from "@/lib/utils"
import type { ReplacementReadinessResult } from "@/lib/equipment-replacement/types"
import type { EquipmentReliabilityResult } from "@/lib/equipment-reliability/types"
import { REPLACEMENT_DISCLAIMER, formatReplacementReadinessLabel } from "@/lib/equipment-replacement/eval"
import { formatEquipmentReliabilityLabel } from "@/lib/equipment-reliability/eval"
import { ReliabilityBadge } from "@/components/equipment-reliability/reliability-badge"
import { ReplacementReadinessBadge } from "@/components/equipment-replacement/replacement-readiness-badge"
import { RefreshCw } from "lucide-react"

export function ReplacementReadinessPanel({
  result,
  reliability,
  className,
  variant = "card",
}: {
  result: ReplacementReadinessResult
  /** Optional service reliability context (Phase 45) — same asset, deterministic. */
  reliability?: EquipmentReliabilityResult | null
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
      {reliability && reliability.label !== "stable" ?
        <div className="rounded-md border border-border/80 bg-muted/30 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Service reliability
            </p>
            <ReliabilityBadge label={reliability.label} className="normal-case" />
          </div>
          <p className="text-xs text-foreground">{formatEquipmentReliabilityLabel(reliability.label)}</p>
          <p className="text-[11px] text-muted-foreground leading-snug">{reliability.reasons[0] ?? ""}</p>
        </div>
      : null}
      <p className="text-[10px] text-muted-foreground leading-snug border-t border-border pt-2">{REPLACEMENT_DISCLAIMER}</p>
    </div>
  )
}
