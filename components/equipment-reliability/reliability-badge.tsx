"use client"

import { cn } from "@/lib/utils"
import type { EquipmentReliabilityLabel } from "@/lib/equipment-reliability/types"
import {
  equipmentReliabilityBadgeClass,
  formatEquipmentReliabilityLabel,
} from "@/lib/equipment-reliability/eval"

export function ReliabilityBadge({
  label,
  className,
}: {
  label: EquipmentReliabilityLabel
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        equipmentReliabilityBadgeClass(label),
        className,
      )}
    >
      {formatEquipmentReliabilityLabel(label)}
    </span>
  )
}
