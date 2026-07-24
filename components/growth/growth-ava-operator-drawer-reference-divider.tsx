"use client"

import { GROWTH_AVA_OPERATOR_DRAWER_REFERENCE_DIVIDER_LABEL } from "@/lib/growth/aios/operator-experience/growth-ava-operator-workspace-3b"
import { GROWTH_AVA_OPERATOR_WORKSPACE_3B_QA_MARKER } from "@/lib/growth/aios/operator-experience/growth-ava-operator-workspace-3b"

type Props = {
  label?: string
}

export function GrowthAvaOperatorDrawerReferenceDivider({
  label = GROWTH_AVA_OPERATOR_DRAWER_REFERENCE_DIVIDER_LABEL,
}: Props) {
  return (
    <div
      className="relative py-6"
      data-qa-marker-ava-operator-workspace-3b={GROWTH_AVA_OPERATOR_WORKSPACE_3B_QA_MARKER}
      data-ava-operator-reference-divider
    >
      <div className="absolute inset-x-0 top-1/2 border-t border-border/70" aria-hidden />
      <p className="relative mx-auto w-fit bg-background px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  )
}
