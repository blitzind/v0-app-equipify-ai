"use client"

import { AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AiOsExecutPlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-types"
import {
  formatUsd,
  GrowthAiOsConfidenceGauge,
  GrowthAiOsKpiCard,
  GrowthAiOsLevelChip,
  riskBadgeTone,
} from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils"
import { cn } from "@/lib/utils"

export function GrowthAiOsBusinessOutcomesSection({ report }: { report: AiOsExecutPlanningReport }) {
  const outcomes = report.expectedOutcomes

  return (
    <Card data-qa-section="business-outcomes">
      <CardHeader className="pb-3">
        <CardTitle>Business outcomes</CardTitle>
        <CardDescription>What you should expect if the recommended plan executes successfully.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <GrowthAiOsKpiCard
            label="Expected revenue"
            value={formatUsd(report.missionAnalysis.estimatedAnnualRevenueUsd)}
          />
          <GrowthAiOsKpiCard
            label="Estimated timeline"
            value={`${report.estimatedTimeline.days} days`}
            hint={report.estimatedTimeline.summary}
          />
          <GrowthAiOsKpiCard
            label="Estimated ROI"
            value={<GrowthAiOsLevelChip label="ROI" level={outcomes.estimatedRoi} />}
          />
          <GrowthAiOsKpiCard
            label="Meeting probability"
            value={`${outcomes.meProbabilityPercent}%`}
          />
          <GrowthAiOsKpiCard
            label="Execution cost"
            value={<GrowthAiOsLevelChip label="Cost" level={outcomes.estimatedExecutionCost} />}
          />
          <GrowthAiOsKpiCard
            label="Confidence"
            value={<GrowthAiOsConfidenceGauge value={report.confidence} size="sm" />}
          />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{outcomes.summary}</p>
      </CardContent>
    </Card>
  )
}

export function GrowthAiOsRiskCardsSection({ report }: { report: AiOsExecutPlanningReport }) {
  return (
    <Card data-qa-section="risk-cards">
      <CardHeader className="pb-3">
        <CardTitle>Risk assessment</CardTitle>
        <CardDescription>
          Overall risk:{" "}
          <span className={cn("font-medium", riskBadgeTone(report.riskAssessment.overallRisk))}>
            {report.riskAssessment.overallRisk}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {report.riskAssessment.risks.map((risk) => (
          <div
            key={risk.label}
            className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <div>
                <p className="font-medium text-foreground">{risk.label}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Mitigation
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{risk.mitigation}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
