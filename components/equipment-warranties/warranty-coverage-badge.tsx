"use client"

import { cn } from "@/lib/utils"
import type { WarrantyCoverageLabel } from "@/lib/equipment-warranties/types"
import {
  formatWarrantyCoverageLabel,
  warrantyCoverageBadgeClass,
} from "@/lib/equipment-warranties/eval"

export { formatWarrantyCoverageLabel, warrantyCoverageBadgeClass }

export function WarrantyCoverageBadge({
  label,
  className,
}: {
  label: WarrantyCoverageLabel
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        warrantyCoverageBadgeClass(label),
        className,
      )}
    >
      {formatWarrantyCoverageLabel(label)}
    </span>
  )
}
