"use client"

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  LEAD_INTELLIGENCE_STAGE_UX_STATE_META,
  type LeadIntelligenceStageUxState,
} from "@/lib/growth/lead-engine/lead-intelligence-stage-display"
import { cn } from "@/lib/utils"

const STATE_ICONS: Record<LeadIntelligenceStageUxState, typeof Circle> = {
  awaiting_input: Circle,
  queued: Clock,
  running: Loader2,
  evidence_ready: Sparkles,
  needs_review: Eye,
  blocked: Ban,
  confidence_low: ShieldAlert,
  completed: CheckCircle2,
}

export function LeadIntelligenceStageStateBadge({
  state,
  className,
}: {
  state: LeadIntelligenceStageUxState
  className?: string
}) {
  const meta = LEAD_INTELLIGENCE_STAGE_UX_STATE_META[state]
  const Icon = STATE_ICONS[state]

  const toneClass =
    meta.tone === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : meta.tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : meta.tone === "danger"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : meta.tone === "info"
            ? "border-sky-300 bg-sky-50 text-sky-950"
            : "border-border bg-muted/40 text-muted-foreground"

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-normal", toneClass, className)}
      title={meta.helperText}
    >
      <Icon className={cn("size-3", state === "running" && "animate-spin")} />
      {meta.label}
    </Badge>
  )
}

export function LeadIntelligenceConfidenceBadge({
  percent,
  band,
  className,
}: {
  percent: number | null
  band: "high" | "medium" | "low" | "unknown"
  className?: string
}) {
  if (percent == null) return null

  const toneClass =
    band === "high"
      ? "border-emerald-300 bg-emerald-50/80 text-emerald-900"
      : band === "medium"
        ? "border-amber-300 bg-amber-50/80 text-amber-950"
        : band === "low"
          ? "border-orange-300 bg-orange-50/80 text-orange-950"
          : "border-border bg-muted/30 text-muted-foreground"

  return (
    <Badge variant="outline" className={cn("font-normal", toneClass, className)}>
      {band === "low" ? <AlertTriangle className="mr-1 size-3" /> : null}
      {percent}% confidence
    </Badge>
  )
}
