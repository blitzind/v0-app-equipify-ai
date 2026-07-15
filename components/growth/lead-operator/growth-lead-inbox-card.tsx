"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BuyingStageCard } from "@/components/growth/revenue-intelligence/buying-stage-card"
import { LeadHealthIndicator } from "@/components/growth/revenue-intelligence/lead-health-indicator"
import { LeadScoreVisual } from "@/components/growth/revenue-intelligence/lead-score-visual"
import { priorityTone } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
import type { RevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { cn } from "@/lib/utils"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

export function GrowthRevenueQueueCard({ card }: { card: RevenueQueueCardView }) {
  const pathname = usePathname()
  const priority = priorityTone(card.candidate_priority)

  return (
    <Link
      href={growthFeaturePath(pathname, `leads/${card.id}`)}
      className={cn(
        "group block rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md",
      )}
      aria-label={`${card.navigation_cta_label ?? "Open account"}: ${card.company_name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{card.company_name}</p>
          {card.domain ? (
            <p className="truncate text-xs text-muted-foreground">{card.domain}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LeadHealthIndicator card={card} />
            <Badge variant={priority.badge} className={cn("capitalize", priority.className)}>
              {card.candidate_priority}
            </Badge>
          </div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <LeadScoreVisual leadScore={card.lead_score} intentScore={card.intent_score} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Buying stage</p>
          <div className="mt-1">
            <BuyingStageCard
              stage={card.buying_stage}
              confidence={card.buying_stage_confidence}
              compact
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Last activity</p>
          <p className="mt-2 text-sm font-medium text-foreground">{card.time_since_activity_label}</p>
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-indigo-700 dark:text-indigo-300">
        {card.navigation_cta_label ?? "Open account"}
      </p>
    </Link>
  )
}

/** @deprecated Use GrowthRevenueQueueCard (GE-LEADS-CANONICAL-4G). */
export const GrowthLeadInboxCard = GrowthRevenueQueueCard
