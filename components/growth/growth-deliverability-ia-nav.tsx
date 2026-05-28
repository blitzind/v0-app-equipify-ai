"use client"

import Link from "next/link"
import { Shield, Server, Activity } from "lucide-react"
import { GROWTH_DELIVERABILITY_IA, GROWTH_OPERATOR_UX_H3_QA_MARKER } from "@/lib/growth/operator-ux/operator-ux-h3-types"
import { cn } from "@/lib/utils"

const ICONS = {
  protection: Shield,
  infrastructure: Server,
  operations: Activity,
} as const

export function GrowthDeliverabilityIaNav({ active }: { active: keyof typeof GROWTH_DELIVERABILITY_IA }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-3"
      data-qa={GROWTH_OPERATOR_UX_H3_QA_MARKER}
    >
      {(Object.keys(GROWTH_DELIVERABILITY_IA) as Array<keyof typeof GROWTH_DELIVERABILITY_IA>).map((key) => {
        const layer = GROWTH_DELIVERABILITY_IA[key]
        const Icon = ICONS[key]
        const isActive = key === active
        return (
          <Link
            key={key}
            href={layer.href}
            className={cn(
              "rounded-xl border px-4 py-3 transition-colors",
              isActive
                ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/30"
                : "border-border/70 bg-background hover:border-indigo-100 hover:bg-muted/20",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-indigo-700 dark:text-indigo-300" />
              <span className="text-sm font-semibold">{layer.label}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{layer.subtitle}</p>
          </Link>
        )
      })}
    </div>
  )
}
