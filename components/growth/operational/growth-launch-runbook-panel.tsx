"use client"

import Link from "next/link"
import { BookOpen, ExternalLink } from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GE_V1_1_LAUNCH_RUNBOOK_QA_MARKER,
  GE_V1_1_LAUNCH_RUNBOOK_STEPS,
} from "@/lib/growth/operational/ge-v1-1-launch-runbook"

export function GrowthLaunchRunbookPanel({ embedded = false }: { embedded?: boolean }) {
  const body = (
    <ol className="space-y-4" data-ge-v1-1-runbook={GE_V1_1_LAUNCH_RUNBOOK_QA_MARKER}>
      {GE_V1_1_LAUNCH_RUNBOOK_STEPS.map((step) => (
        <li key={step.order} className="rounded-md border p-3">
          <div className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              {step.order}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
              <Link
                href={step.href}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
              >
                {step.hrefLabel}
                <ExternalLink className="size-3 opacity-60" />
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )

  if (embedded) return body

  return (
    <GrowthEngineCard title="How to Launch an Equipify Campaign" icon={<BookOpen className="size-4" />}>
      <p className="mb-4 text-sm text-muted-foreground">
        Ten-step operator path from prospect search to booked demo.
      </p>
      {body}
    </GrowthEngineCard>
  )
}
