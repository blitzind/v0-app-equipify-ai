"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BuyingStageCard } from "@/components/growth/revenue-intelligence/buying-stage-card"
import { ConfidenceBar } from "@/components/growth/revenue-intelligence/confidence-bar"
import { EvidenceStrengthCard } from "@/components/growth/revenue-intelligence/evidence-strength-card"
import { LeadHealthIndicator } from "@/components/growth/revenue-intelligence/lead-health-indicator"
import { LeadScoreVisual } from "@/components/growth/revenue-intelligence/lead-score-visual"
import { formatLabel, priorityTone } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
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
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Confidence</p>
          <ConfidenceBar value={card.candidate_confidence} className="mt-2" />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Motion</dt>
          <dd className="font-medium capitalize text-foreground">{formatLabel(card.recommended_motion)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Urgency</dt>
          <dd className="font-medium capitalize text-foreground">{formatLabel(card.recommended_urgency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Owner</dt>
          <dd className="font-medium capitalize text-foreground">{formatLabel(card.recommended_owner)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last activity</dt>
          <dd className="font-medium text-foreground">{card.time_since_activity_label}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sessions</dt>
          <dd className="font-medium text-foreground">{card.session_count}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Company match</dt>
          <dd className="font-medium text-foreground">
            {card.company_match_confidence != null
              ? `${(card.company_match_confidence * 100).toFixed(0)}%`
              : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <EvidenceStrengthCard strength={card.evidence_strength} evidenceCount={card.evidence_count} />
      </div>

      {card.search_intent_category || card.search_intent_keyword ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Search: {card.search_intent_category ? formatLabel(card.search_intent_category) : "—"}
          {card.search_intent_keyword ? ` · ${card.search_intent_keyword}` : ""}
        </p>
      ) : null}

      {card.intent_indicators.length > 0 ? (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {card.intent_indicators.join(" · ")}
        </p>
      ) : null}

      {card.human_review_required ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-800">
          <ShieldAlert className="size-3.5" />
          Needs review
        </p>
      ) : null}
    </Link>
  )
}

/** @deprecated Use GrowthRevenueQueueCard (GE-LEADS-CANONICAL-4G). */
export const GrowthLeadInboxCard = GrowthRevenueQueueCard
