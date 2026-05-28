"use client"

import Link from "next/link"
import { CheckCircle2, Circle } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_OPERATOR_DAILY_WORKFLOW, GROWTH_OPERATOR_UX_H3_QA_MARKER } from "@/lib/growth/operator-ux/operator-ux-h3-types"

export function GrowthOperatorDailyWorkflow() {
  return (
    <GrowthEngineCard
      title="Today's operator workflow"
      className="border-indigo-100/80 dark:border-indigo-900/30"
      data-qa={GROWTH_OPERATOR_UX_H3_QA_MARKER}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Repeatable daily path — links open existing approval, recovery, and search surfaces.
      </p>
      <ol className="space-y-2">
        {GROWTH_OPERATOR_DAILY_WORKFLOW.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/30"
            >
              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-sm font-medium">
                  <span className="mr-2 text-xs text-muted-foreground">{step.order}.</span>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <CheckCircle2 className="ml-auto size-4 shrink-0 text-transparent" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </GrowthEngineCard>
  )
}
