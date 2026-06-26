"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type {
  AiOsExecutivePlanningReportCostLevel,
  AiOsExecutivePlanningReportOpportunityLevel,
  AiOsExecutivePlanningReportRoiLevel,
} from "@/lib/growth/aios/ai-executive-planning-report-types"

export function formatUsd(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function levelBadgeVariant(
  level: AiOsExecutivePlanningReportOpportunityLevel | AiOsExecutivePlanningReportRoiLevel | AiOsExecutivePlanningReportCostLevel,
) {
  if (level === "High") return "default" as const
  if (level === "Medium") return "secondary" as const
  return "outline" as const
}

export function riskBadgeTone(level: AiOsExecutivePlanningReportOpportunityLevel) {
  if (level === "High") return "border-rose-200 bg-rose-50 text-rose-800"
  if (level === "Medium") return "border-amber-200 bg-amber-50 text-amber-900"
  return "border-emerald-200 bg-emerald-50 text-emerald-800"
}

export function confidenceTone(score: number) {
  if (score >= 75) return "text-emerald-600"
  if (score >= 45) return "text-amber-600"
  return "text-muted-foreground"
}

export function GrowthAiOsKpiCard({
  label,
  value,
  hint,
  badge,
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  badge?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-lg font-semibold tracking-tight text-foreground">{value}</p>
        {badge}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function GrowthAiOsConfidenceGauge({
  value,
  label,
  size = "md",
}: {
  value: number
  label?: string
  size?: "sm" | "md"
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const radius = size === "sm" ? 18 : 24
  const stroke = size === "sm" ? 4 : 5
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const dimension = (radius + stroke) * 2

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <svg width={dimension} height={dimension} className="-rotate-90" aria-hidden>
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
        />
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={confidenceTone(clamped)}
        />
      </svg>
      <div>
        <p className={cn("font-semibold", size === "sm" ? "text-sm" : "text-base", confidenceTone(clamped))}>
          {clamped}%
        </p>
        {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
      </div>
    </div>
  )
}

export function GrowthAiOsLevelChip({
  label,
  level,
}: {
  label: string
  level: AiOsExecutivePlanningReportOpportunityLevel | AiOsExecutivePlanningReportRoiLevel | AiOsExecutivePlanningReportCostLevel
}) {
  return (
    <Badge variant={levelBadgeVariant(level)} className="text-[11px] uppercase tracking-wide">
      {label}: {level}
    </Badge>
  )
}

export function GrowthAiOsProgressBar({
  value,
  label,
}: {
  value: number
  label?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        {label ? <span className="text-muted-foreground">{label}</span> : <span />}
        <span className="font-medium text-foreground">{clamped}%</span>
      </div>
      <Progress value={clamped} className="h-2.5" />
    </div>
  )
}
