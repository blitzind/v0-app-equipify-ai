"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { GrowthHomeAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_OWNERSHIP_WAITING_ON_YOU_TITLE } from "@/lib/workspace/ai-ownership-accountability"
import { Button } from "@/components/ui/button"

type Props = {
  aiOsUx: GrowthHomeAiOsUxViewModel
}

export function GrowthHomeAiOsWaitingOnYouSection({ aiOsUx }: Props) {
  const { waitingOnYou, waitingOnYouOverflow, approveItemsHref, approveItemsCount } = aiOsUx
  if (waitingOnYou.length === 0 && approveItemsCount <= 0) return null

  return (
    <section data-qa-section="home-waiting-on-you" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{AI_OWNERSHIP_WAITING_ON_YOU_TITLE}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approvals, blocked items, and urgent replies that need you before I can continue.
          </p>
        </div>
        {approveItemsHref && approveItemsCount > 0 ? (
          <Button asChild size="lg">
            <Link href={approveItemsHref}>
              Approve Items
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      {waitingOnYou.length > 0 ? (
        <div className="space-y-3">
          {waitingOnYou.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
            >
              <p className="font-medium text-foreground">{item.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </article>
          ))}
        </div>
      ) : null}

      {waitingOnYouOverflow > 0 ? (
        <p className="text-sm text-muted-foreground">
          {waitingOnYouOverflow} additional items collapsed in additional tools below.
        </p>
      ) : null}
    </section>
  )
}
