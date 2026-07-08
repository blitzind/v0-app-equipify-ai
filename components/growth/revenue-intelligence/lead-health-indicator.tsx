"use client"

import { Activity, AlertTriangle, CheckCircle2, PauseCircle } from "lucide-react"
import {
  deriveLeadHealth,
  formatLabel,
  type RevenueLeadHealth,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
import type { RevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { cn } from "@/lib/utils"

const HEALTH_CONFIG: Record<
  RevenueLeadHealth,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  healthy: { label: "Healthy", icon: CheckCircle2, className: "text-emerald-700 bg-emerald-50" },
  attention: { label: "Needs attention", icon: Activity, className: "text-amber-800 bg-amber-50" },
  at_risk: { label: "At risk", icon: AlertTriangle, className: "text-red-800 bg-red-50" },
  stalled: { label: "Stalled", icon: PauseCircle, className: "text-muted-foreground bg-muted" },
}

export function LeadHealthIndicator({
  card,
  className,
}: {
  card: Pick<
    RevenueQueueCardView,
    | "human_review_required"
    | "candidate_priority"
    | "verification_state"
    | "status"
    | "intent_score"
    | "candidate_confidence"
  >
  className?: string
}) {
  const health = deriveLeadHealth(card)
  const config = HEALTH_CONFIG[health]
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {formatLabel(config.label)}
    </span>
  )
}
