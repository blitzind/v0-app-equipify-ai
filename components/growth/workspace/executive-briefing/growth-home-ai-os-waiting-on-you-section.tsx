"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import type { GrowthHomeAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  GROWTH_HOME_NEEDS_YOUR_ATTENTION,
  GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER,
} from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import {
  GROWTH_HOME_NEEDS_YOUR_DECISION_SUBTITLE,
} from "@/lib/growth/workspace/executive-briefing/growth-home-premium-ux-1a"
import { GROWTH_HOME_NOTHING_REQUIRES_APPROVAL } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"
import { Button } from "@/components/ui/button"

type Props = {
  aiOsUx: GrowthHomeAiOsUxViewModel
}

export function GrowthHomeAiOsWaitingOnYouSection({ aiOsUx }: Props) {
  const { waitingOnYou, waitingOnYouOverflow, approveItemsHref, approveItemsCount } = aiOsUx
  const hasItems = waitingOnYou.length > 0 || approveItemsCount > 0

  return (
    <section
      data-qa-section="home-needs-your-attention"
      data-home-experience-2b={GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card p-4 space-y-3 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_NEEDS_YOUR_ATTENTION}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasItems ? GROWTH_HOME_NEEDS_YOUR_DECISION_SUBTITLE : GROWTH_HOME_NOTHING_REQUIRES_APPROVAL}
          </p>
        </div>
        {approveItemsHref && approveItemsCount > 0 ? (
          <Button asChild size="sm">
            <Link href={approveItemsHref}>
              Review items
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      {!hasItems ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="text-sm font-medium text-foreground">{GROWTH_HOME_NOTHING_REQUIRES_APPROVAL}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {waitingOnYou.map((item) => (
            <article key={item.id} className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.detail}</p>
            </article>
          ))}
        </div>
      )}

      {waitingOnYouOverflow > 0 ? (
        <p className="text-xs text-muted-foreground">
          {waitingOnYouOverflow} more in additional tools below.
        </p>
      ) : null}
    </section>
  )
}
