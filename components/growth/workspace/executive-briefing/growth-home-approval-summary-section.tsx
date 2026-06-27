"use client"

import Link from "next/link"
import type { GrowthHomeApprovalSummary } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_OS_APPROVALS_SECTION_SUBTITLE,
  AI_OS_APPROVALS_SECTION_TITLE,
} from "@/lib/workspace/ai-os-outcome-first-terminology"
import { Button } from "@/components/ui/button"

type Props = {
  summary: GrowthHomeApprovalSummary | null
}

export function GrowthHomeApprovalSummarySection({ summary }: Props) {
  if (!summary || summary.totalPending === 0) return null

  return (
    <section data-qa-section="home-exceptions-approvals" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_OS_APPROVALS_SECTION_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{AI_OS_APPROVALS_SECTION_SUBTITLE}</p>
      </div>

      <article className="rounded-xl border border-border/70 bg-card p-5">
        <ul className="space-y-2">
          {summary.groups.map((group) => (
            <li key={group.id} className="flex items-baseline justify-between gap-4 text-base">
              <span className="font-semibold tabular-nums">{group.count}</span>
              <span className="flex-1 text-muted-foreground">{group.label}</span>
            </li>
          ))}
        </ul>
        <Button asChild className="mt-5">
          <Link href={summary.reviewHref}>Review approvals</Link>
        </Button>
      </article>
    </section>
  )
}
