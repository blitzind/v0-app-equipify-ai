"use client"

import Link from "next/link"
import { ArrowRight, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GrowthLeadInboxCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { cn } from "@/lib/utils"

function motionLabel(motion: string): string {
  return motion.replace(/_/g, " ")
}

export function GrowthLeadInboxCard({ card }: { card: GrowthLeadInboxCardView }) {
  return (
    <Link
      href={`/admin/growth/leads/${card.id}`}
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
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {card.candidate_priority === "urgent" || card.candidate_priority === "high" ? (
          <Badge variant="default">{card.candidate_priority}</Badge>
        ) : (
          <Badge variant="secondary">{card.candidate_priority}</Badge>
        )}
        <Badge variant="outline">Intent {card.intent_score}</Badge>
        {card.lead_score != null ? (
          <Badge variant="outline">Score {card.lead_score}</Badge>
        ) : null}
        <Badge variant="outline">{card.verification_state}</Badge>
        <Badge variant="outline">{motionLabel(card.recommended_motion)}</Badge>
        <Badge variant="outline">{card.recommended_urgency.replace(/_/g, " ")}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline">Type </dt>
          <dd className="inline font-medium text-foreground">{card.candidate_type.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="inline">Approval </dt>
          <dd className="inline font-medium text-foreground">{card.human_approval_state}</dd>
        </div>
        <div>
          <dt className="inline">Owner </dt>
          <dd className="inline font-medium text-foreground">
            {card.recommended_owner.replace(/_/g, " ")}
          </dd>
        </div>
        <div>
          <dt className="inline">Activity </dt>
          <dd className="inline font-medium text-foreground">{card.time_since_activity_label}</dd>
        </div>
        <div>
          <dt className="inline">Sessions </dt>
          <dd className="inline font-medium text-foreground">{card.session_count}</dd>
        </div>
        <div>
          <dt className="inline">Confidence </dt>
          <dd className="inline font-medium text-foreground">
            {(card.candidate_confidence * 100).toFixed(0)}%
          </dd>
        </div>
      </dl>

      {card.intent_indicators.length > 0 ? (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {card.intent_indicators.join(" · ")}
        </p>
      ) : null}

      {card.human_review_required ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-800">
          <ShieldAlert className="size-3.5" />
          Human review required
        </p>
      ) : null}
    </Link>
  )
}
