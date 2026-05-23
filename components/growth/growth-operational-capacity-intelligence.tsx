"use client"

import { Shield } from "lucide-react"
import { GrowthBadge, GrowthActionRequiredBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { growthLeadCapacityActionRequired } from "@/lib/growth/growth-lead-drawer-badges"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthOperationalCapacityIntelligenceProps = {
  lead: GrowthLead
}

function tierTone(tier: GrowthLead["operationalCapacityTier"]): "healthy" | "warning" | "neutral" {
  if (tier === "healthy") return "healthy"
  if (tier === "strained") return "neutral"
  return "warning"
}

function recoveryTone(
  direction: GrowthLead["capacityRecoveryDirection"],
): "healthy" | "warning" | "neutral" {
  if (direction === "recovering") return "healthy"
  if (direction === "worsening") return "warning"
  return "neutral"
}

export function GrowthOperationalCapacityIntelligence({ lead }: GrowthOperationalCapacityIntelligenceProps) {
  const collapsedSummary = [
    lead.operationalCapacityScore != null ? `${lead.operationalCapacityScore}` : null,
    lead.operationalCapacityTier?.replace(/_/g, " ") ?? null,
    lead.capacityPressureLevel > 0 ? `pressure ${lead.capacityPressureLevel}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <GrowthCollapsibleEngineCard
      title="Operational Capacity"
      icon={<Shield className="size-4" />}
      headerAside={collapsedSummary || "No capacity data"}
      headerTrailing={growthLeadCapacityActionRequired(lead) ? <GrowthActionRequiredBadge /> : null}
      defaultOpen
      persistKey={GROWTH_DRAWER_CARD_KEYS.capacity}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {lead.operationalCapacityScore ?? "—"}
          </span>
          {lead.operationalCapacityTier ? (
            <GrowthBadge
              label={lead.operationalCapacityTier.replace(/_/g, " ")}
              tone={tierTone(lead.operationalCapacityTier)}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-muted-foreground">
            Pressure:{" "}
            <span className="font-medium text-foreground">{lead.capacityPressureLevel}</span>
          </span>
          <span className="text-muted-foreground">
            Volatility:{" "}
            <span className="font-medium text-foreground">{lead.capacityPressureVolatility}</span>
          </span>
          <span className="text-muted-foreground">
            Protected coverage:{" "}
            <span className="font-medium text-foreground">{lead.protectedPipelineCoverage}%</span>
          </span>
          {lead.constraintOpenedAt ? (
            <span className="text-muted-foreground">
              Constraint age:{" "}
              <span className="font-medium text-foreground">{lead.constraintAgeBucket}</span>
            </span>
          ) : null}
          <GrowthBadge
            label={lead.capacityRecoveryDirection.replace(/_/g, " ")}
            tone={recoveryTone(lead.capacityRecoveryDirection)}
          />
        </div>

        {lead.operationalCapacitySummary ? (
          <p className="text-sm text-foreground">{lead.operationalCapacitySummary}</p>
        ) : null}

        {lead.capacityProtectionRecommendation ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Execution protection</p>
            <p className="mt-1 text-sm text-amber-950">{lead.capacityProtectionRecommendation}</p>
          </div>
        ) : null}

        {lead.operationalConstraints.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Platform constraints
            </p>
            <ul className="space-y-1.5">
              {lead.operationalConstraints.map((constraint) => (
                <li key={constraint.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className={constraint.severity === "critical" ? "text-rose-800" : "text-amber-800"}>
                    {constraint.label}
                  </span>
                  <GrowthBadge
                    label={constraint.severity}
                    tone={constraint.severity === "critical" ? "warning" : "neutral"}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {lead.capacityConflicts.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Capacity conflicts
            </p>
            <ul className="space-y-1.5">
              {lead.capacityConflicts.map((conflict) => (
                <li key={conflict.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className={conflict.severity === "critical" ? "text-rose-800" : "text-amber-800"}>
                    {conflict.label}
                  </span>
                  <GrowthBadge
                    label={conflict.severity}
                    tone={conflict.severity === "critical" ? "warning" : "neutral"}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {lead.operationalCapacityTopConstraints.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Top pressure signals
            </p>
            <ul className="space-y-1.5">
              {lead.operationalCapacityTopConstraints.map((entry, index) => (
                <li key={`${entry.kind}-${index}`} className="flex justify-between gap-3 text-sm">
                  <span>{entry.label}</span>
                  <span className="tabular-nums text-muted-foreground">{entry.pressure}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
