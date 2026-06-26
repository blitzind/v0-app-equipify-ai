"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AiOsExecutPlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-types"
import type { AiOsExecutWorkOrderProposal } from "@/lib/growth/aios/ai-executive-mission-planning-types"
import {
  formatUsd,
  GrowthAiOsConfidenceGauge,
  GrowthAiOsKpiCard,
  GrowthAiOsLevelChip,
} from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils"

function resolvePrimaryAction(
  report: AiOsExecutPlanningReport,
  proposals: AiOsExecutWorkOrderProposal[],
): string {
  const currentStep = report.recommendedStrategy.steps.find((step) => step.status === "current")
  if (currentStep?.label) return currentStep.label
  if (proposals[0]?.rationale) return proposals[0].rationale
  return report.recommendedStrategy.summary
}

export function GrowthAiOsExecutSummarySection({
  report,
  proposals,
}: {
  report: AiOsExecutPlanningReport
  proposals: AiOsExecutWorkOrderProposal[]
}) {
  const primaryAction = resolvePrimaryAction(report, proposals)

  return (
    <Card data-qa-section="executive-summary">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">{report.missionSummary.title}</CardTitle>
        <CardDescription>
          Executive operating view — {report.currentStage.label} stage · {report.missionSummary.status}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <GrowthAiOsKpiCard
            label="Stage"
            value={report.currentStage.label}
            hint={report.currentStage.status}
            badge={<Badge variant="secondary">{report.currentStage.stageId}</Badge>}
          />
          <GrowthAiOsKpiCard
            label="Overall progress"
            value={`${report.missionSummary.progress.percent}%`}
            hint={`${report.missionSummary.progress.current}/${report.missionSummary.progress.target} toward target`}
          />
          <GrowthAiOsKpiCard
            label="Confidence"
            value={<GrowthAiOsConfidenceGauge value={report.confidence} size="sm" />}
          />
          <GrowthAiOsKpiCard
            label="Estimated revenue"
            value={formatUsd(report.missionAnalysis.estimatedAnnualRevenueUsd)}
            hint={`Company fit ${report.missionAnalysis.companyFitScore}%`}
          />
          <GrowthAiOsKpiCard
            label="Estimated timeline"
            value={`${report.estimatedTimeline.days} days`}
            hint={report.estimatedTimeline.summary}
          />
          <GrowthAiOsKpiCard
            label="Overall risk"
            value={
              <GrowthAiOsLevelChip label="Risk" level={report.riskAssessment.overallRisk} />
            }
          />
          <GrowthAiOsKpiCard
            label="Expected ROI"
            value={<GrowthAiOsLevelChip label="ROI" level={report.expectedOutcomes.estimatedRoi} />}
          />
          <GrowthAiOsKpiCard
            label="Primary recommended action"
            value={<span className="text-base leading-snug">{primaryAction}</span>}
            hint="What AI recommends doing next"
            className="sm:col-span-2 xl:col-span-4"
          />
        </div>
      </CardContent>
    </Card>
  )
}
