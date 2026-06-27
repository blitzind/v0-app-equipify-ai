"use client"

import Link from "next/link"
import type { GrowthHomeNeedsReview } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_EMPLOYEE_NEEDS_REVIEW_TITLE } from "@/lib/workspace/ai-employee-experience"
import { Button } from "@/components/ui/button"

type Props = {
  needsReview: GrowthHomeNeedsReview
}

export function GrowthHomeNeedsReviewSection({ needsReview }: Props) {
  const hasContent = needsReview.totalCount > 0 || needsReview.attentionItems.length > 0
  if (!hasContent) return null

  return (
    <section data-qa-section="home-needs-your-review" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_EMPLOYEE_NEEDS_REVIEW_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Grouped by what needs your input.</p>
      </div>

      {needsReview.groups.length > 0 ? (
        <article className="rounded-xl border border-border/70 bg-card p-5">
          <ul className="space-y-3">
            {needsReview.groups.map((group) => (
              <li key={group.id} className="flex items-baseline justify-between gap-4 text-base">
                <span className="font-medium text-foreground">{group.label}</span>
                <span className="tabular-nums font-semibold text-muted-foreground">{group.count}</span>
              </li>
            ))}
          </ul>
          {needsReview.totalCount > 0 ? (
            <Button asChild className="mt-5">
              <Link href={needsReview.reviewHref}>Review now</Link>
            </Button>
          ) : null}
        </article>
      ) : null}

      {needsReview.attentionItems.length > 0 ? (
        <div className="space-y-3">
          {needsReview.attentionItems.map((item) => (
            <article key={item.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">{item.headline}</p>
                  <p className="text-sm text-muted-foreground">{item.summary}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={item.ctaHref}>{item.ctaLabel}</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
