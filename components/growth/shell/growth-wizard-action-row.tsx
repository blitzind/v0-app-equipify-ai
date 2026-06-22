"use client"

import type { ComponentPropsWithoutRef } from "react"
import { cn } from "@/lib/utils"
import { GROWTH_FLOATING_INSET_QA_MARKER, GROWTH_WIZARD_ACTION_ROW } from "@/lib/layout/aiden-safe-area"

type GrowthWizardActionRowProps = ComponentPropsWithoutRef<"div"> & {
  align?: "between" | "end" | "start"
}

/** Back | Continue rows and wizard step footers — keeps primary actions out of AIden’s footprint. */
export function GrowthWizardActionRow({ align = "between", className, ...props }: GrowthWizardActionRowProps) {
  return (
    <div
      className={cn(
        GROWTH_WIZARD_ACTION_ROW,
        align === "between" && "justify-between",
        align === "end" && "justify-end",
        align === "start" && "justify-start",
        className,
      )}
      data-growth-floating-inset={GROWTH_FLOATING_INSET_QA_MARKER}
      {...props}
    />
  )
}
