"use client"

import { cn } from "@/lib/utils"
import type { EquipmentReliabilityResult } from "@/lib/equipment-reliability/types"
import { RELIABILITY_DISCLAIMER, formatEquipmentReliabilityLabel } from "@/lib/equipment-reliability/eval"
import { ReliabilityBadge } from "@/components/equipment-reliability/reliability-badge"
import { Activity } from "lucide-react"

export function ReliabilityPanel({
  result,
  className,
  variant = "card",
}: {
  result: EquipmentReliabilityResult
  className?: string
  variant?: "card" | "inline"
}) {
  const wrap = variant === "card" ? "rounded-lg border border-border bg-card/60 p-4 space-y-3" : "space-y-2"

  return (
    <div className={cn(wrap, className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Service reliability
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Data quality: {result.dataQuality}</p>
          </div>
        </div>
        <ReliabilityBadge label={result.label} className="shrink-0" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{formatEquipmentReliabilityLabel(result.label)}</p>
        <ul className="mt-2 text-xs text-muted-foreground space-y-1 list-disc pl-4">
          {result.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug border-t border-border pt-2">{RELIABILITY_DISCLAIMER}</p>
    </div>
  )
}
