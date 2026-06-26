"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AiExecutivePlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-types"
import { GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER } from "@/lib/growth/aios/ai-executive-planning-report-types"

function levelBadgeVariant(level: string) {
  if (level === "High") return "default" as const
  if (level === "Medium") return "secondary" as const
  return "outline" as const
}

function formatUsd(value: number | null): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

export function GrowthAiOsExecutivePlanningReportSection({ report }: { report: AiExecutivePlanningReport }) {
  return (
    <Card data-qa-marker={GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER} data-report-id={report.reportId}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Executive Planning Report
          <Badge variant="outline">Read-only</Badge>
          <Badge variant="secondary">{report.confidence}% confidence</Badge>
        </CardTitle>
        <CardDescription>
          VP-of-Sales strategy synthesis — explains why Work Orders are proposed. No execution, outbound, or
          provider calls from this report.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <section className="space-y-2">
          <h3 className="font-medium">Mission Summary</h3>
          <p>{report.missionSummary.title}</p>
          <p className="text-muted-foreground">
            {report.missionSummary.progress.current}/{report.missionSummary.progress.target} (
            {report.missionSummary.progress.percent}%)
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Mission Analysis</h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            <li>Company fit: {report.missionAnalysis.companyFitScore}%</li>
            <li>Industry opportunity: {report.missionAnalysis.industryOpportunity}</li>
            <li>Estimated annual revenue: {formatUsd(report.missionAnalysis.estimatedAnnualRevenueUsd)}</li>
            <li>Confidence: {report.missionAnalysis.confidenceScore}%</li>
          </ul>
          <p className="text-muted-foreground">{report.missionAnalysis.icpSummary}</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Current Stage</h3>
          <p>
            {report.currentStage.label} ({report.currentStage.stageId}) — {report.currentStage.status},{" "}
            {report.currentStage.progress}% progress
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Business Reasoning</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {report.businessReasoning.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Recommended Strategy</h3>
          <p className="text-muted-foreground">{report.recommendedStrategy.summary}</p>
          <ol className="list-decimal space-y-1 pl-5">
            {report.recommendedStrategy.steps.map((step) => (
              <li key={`${step.stepNumber}-${step.label}`}>
                <span className="font-medium">{step.label}</span>
                {step.workOrderType ? (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">({step.workOrderType})</span>
                ) : null}
                <Badge className="ml-2" variant={step.status === "current" ? "default" : "outline"}>
                  {step.status}
                </Badge>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Expected Outcomes</h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            <li>Meeting probability: {report.expectedOutcomes.meProbabilityPercent}%</li>
            <li>
              Estimated ROI:{" "}
              <Badge variant={levelBadgeVariant(report.expectedOutcomes.estimatedRoi)}>
                {report.expectedOutcomes.estimatedRoi}
              </Badge>
            </li>
            <li>
              Execution cost:{" "}
              <Badge variant={levelBadgeVariant(report.expectedOutcomes.estimatedExecutionCost)}>
                {report.expectedOutcomes.estimatedExecutionCost}
              </Badge>
            </li>
            <li>Expected duration: {report.expectedOutcomes.expectedDurationDays} days</li>
          </ul>
          <p className="text-muted-foreground">{report.expectedOutcomes.summary}</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Risk Assessment</h3>
          <p>
            Overall risk:{" "}
            <Badge variant={levelBadgeVariant(report.riskAssessment.overallRisk)}>
              {report.riskAssessment.overallRisk}
            </Badge>
          </p>
          <ul className="space-y-2">
            {report.riskAssessment.risks.map((risk) => (
              <li key={risk.label} className="rounded-md border px-3 py-2">
                <p className="font-medium">{risk.label}</p>
                <p className="text-xs text-muted-foreground">Mitigation: {risk.mitigation}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Multi-step Work Order Plan</h3>
          <p className="text-muted-foreground">
            Constitutional Work Order sequence for current stage context (dry-run proposals below remain
            operator-approved).
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            {report.multiStepWorkOrderPlan.map((step) => (
              <li key={`${step.sequence}-${step.workOrderType}`}>
                {step.label} → {step.assignedAgent}
                {step.duplicateSkipped ? (
                  <Badge className="ml-2" variant="outline">
                    duplicate-skipped
                  </Badge>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Alternative Strategies</h3>
          <ul className="space-y-2">
            {report.alternativeStrategies.map((alt) => (
              <li key={alt.name} className="rounded-md border px-3 py-2">
                <p className="font-medium">{alt.name}</p>
                <p className="text-muted-foreground">{alt.summary}</p>
                <p className="text-xs text-destructive/80">Rejected: {alt.whyRejected}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Success Criteria</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {report.successCriteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Human Approval Notes</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {report.humanApprovalNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Future Learning</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {report.futureLearningPlaceholders.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-muted-foreground">
          Sources: {report.contextSnapshot.sourcesUsed.join(", ")} · Decision records:{" "}
          {report.contextSnapshot.decisionRecordCount} · Memory entries: {report.contextSnapshot.memoryEntryCount}
        </p>
      </CardContent>
    </Card>
  )
}
