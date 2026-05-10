"use client"

import { cn } from "@/lib/utils"
import type { ReplacementReadinessLabel } from "@/lib/equipment-replacement/types"
import {
  formatReplacementReadinessLabel,
  replacementReadinessBadgeClass,
} from "@/lib/equipment-replacement/eval"

export function ReplacementReadinessBadge({
  label,
  className,
}: {
  label: ReplacementReadinessLabel
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        replacementReadinessBadgeClass(label),
        className,
      )}
    >
      {formatReplacementReadinessLabel(label)}
    </span>
  )
}
