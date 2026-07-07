"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { GrowthHomeAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  GROWTH_HOME_AVA_IDLE,
  GROWTH_HOME_CAUGHT_UP_TITLE,
  GROWTH_HOME_NEEDS_YOUR_ATTENTION,
  GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER,
} from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import { GROWTH_HOME_NEEDS_YOUR_DECISION_SUBTITLE } from "@/lib/growth/workspace/executive-briefing/growth-home-premium-ux-1a"
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
      className="space-y-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{GROWTH_HOME_NEEDS_YOUR_ATTENTION}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasItems ? GROWTH_HOME_NEEDS_YOUR_DECISION_SUBTITLE : "Nothing blocking Ava right now."}
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
        <div className="rounded-lg bg-muted/25 px-4 py-3 dark:bg-muted/15">
          <p className="text-sm font-medium">{GROWTH_HOME_CAUGHT_UP_TITLE}</p>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_HOME_AVA_IDLE}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {waitingOnYou.map((item) => (
            <article key={item.id} className="rounded-lg bg-amber-500/8 px-3 py-2.5 dark:bg-amber-500/10">
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
