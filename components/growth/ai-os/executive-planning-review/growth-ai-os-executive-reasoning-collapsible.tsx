"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { AiOsExecutPlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-types"
import { GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER } from "@/lib/growth/aios/ai-executive-planning-report-types"
import { cn } from "@/lib/utils"
import { formatUsd } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils"

function ReasoningSection({
  title,
  summary,
  children,
}: {
  title: string
  summary?: string
  children: ReactNode
}) {
  return (
    <Collapsible defaultOpen={false} className="rounded-lg border border-border/60 bg-muted/10">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {summary ? <p className="truncate text-xs text-muted-foreground">{summary}</p> : null}
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-4 py-3 text-sm">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function GrowthAiOsExecutReasoningCollapsible({ report }: { report: AiOsExecutPlanningReport }) {
  return (
    <Card
      data-qa-marker={GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER}
      data-qa-section="executive-reasoning"
      data-report-id={report.reportId}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          Executive reasoning
          <Badge variant="outline">Detailed report</Badge>
        </CardTitle>
        <CardDescription>
          Collapsed by default — expand for mission analysis, strategy, risks, and learning notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <ReasoningSection title="Mission analysis" summary={report.missionAnalysis.icpSummary}>
          <ul className="grid gap-2 sm:grid-cols-2">
            <li>Company fit: {report.missionAnalysis.companyFitScore}%</li>
            <li>Industry opportunity: {report.missionAnalysis.industryOpportunity}</li>
            <li>Estimated annual revenue: {formatUsd(report.missionAnalysis.estimatedAnnualRevenueUsd)}</li>
            <li>Confidence: {report.missionAnalysis.confidenceScore}%</li>
          </ul>
          <p className="mt-3 text-muted-foreground">{report.missionAnalysis.icpSummary}</p>
          {report.missionAnalysis.entitySignals.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {report.missionAnalysis.entitySignals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          ) : null}
        </ReasoningSection>

        <ReasoningSection
          title="Business reasoning"
          summary={`${report.businessReasoning.length} strategic points`}
        >
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {report.businessReasoning.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </ReasoningSection>

        <ReasoningSection title="Strategy" summary={report.recommendedStrategy.summary}>
          <p className="text-muted-foreground">{report.recommendedStrategy.summary}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {report.recommendedStrategy.steps.map((step) => (
              <li key={`${step.stepNumber}-${step.label}`}>
                <span className="font-medium">{step.label}</span>
                <Badge
                  className={cn("ml-2", step.status === "current" && "bg-indigo-600 hover:bg-indigo-600")}
                  variant={step.status === "current" ? "default" : "outline"}
                >
                  {step.status}
                </Badge>
                {step.rationale ? (
                  <p className="mt-1 text-xs text-muted-foreground">{step.rationale}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </ReasoningSection>

        <ReasoningSection
          title="Risk analysis"
          summary={`Overall ${report.riskAssessment.overallRisk} risk`}
        >
          <ul className="space-y-2">
            {report.riskAssessment.risks.map((risk) => (
              <li key={risk.label} className="rounded-md border px-3 py-2">
                <p className="font-medium">{risk.label}</p>
                <p className="text-xs text-muted-foreground">Mitigation: {risk.mitigation}</p>
              </li>
            ))}
          </ul>
        </ReasoningSection>

        <ReasoningSection
          title="Alternative strategies"
          summary={`${report.alternativeStrategies.length} alternatives considered`}
        >
          <ul className="space-y-2">
            {report.alternativeStrategies.map((alt) => (
              <li key={alt.name} className="rounded-md border px-3 py-2">
                <p className="font-medium">{alt.name}</p>
                <p className="text-muted-foreground">{alt.summary}</p>
                <p className="text-xs text-destructive/80">Rejected: {alt.whyRejected}</p>
              </li>
            ))}
          </ul>
        </ReasoningSection>

        <ReasoningSection
          title="Success criteria"
          summary={`${report.successCriteria.length} criteria`}
        >
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {report.successCriteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ReasoningSection>

        <ReasoningSection
          title="Future learning"
          summary={`${report.futureLearningPlaceholders.length} learning hooks`}
        >
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {report.futureLearningPlaceholders.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {report.humanApprovalNotes.length > 0 ? (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Human approval notes
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {report.humanApprovalNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          ) : null}
        </ReasoningSection>

        <p className="pt-2 text-xs text-muted-foreground">
          Sources: {report.contextSnapshot.sourcesUsed.join(", ")} · Decision records:{" "}
          {report.contextSnapshot.decisionRecordCount} · Memory entries: {report.contextSnapshot.memoryEntryCount}
        </p>
      </CardContent>
    </Card>
  )
}
