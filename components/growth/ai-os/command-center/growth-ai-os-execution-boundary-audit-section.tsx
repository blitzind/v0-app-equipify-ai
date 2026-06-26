"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_CLASSIFICATIONS,
  type GrowthLeadResearchExecutionBoundaryAuditReadModel,
  type GrowthLeadResearchExecutionBoundaryClassification,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"

function classificationBadgeVariant(classification: GrowthLeadResearchExecutionBoundaryClassification) {
  if (classification === "not_allowed") return "destructive" as const
  if (classification === "outbound_requires_human_approval") return "default" as const
  if (classification === "core_mutation_requires_explicit_approval") return "destructive" as const
  if (classification === "planning_only") return "outline" as const
  return "secondary" as const
}

function riskTone(risk: "none" | "low" | "medium" | "high") {
  if (risk === "high") return "text-rose-700"
  if (risk === "medium") return "text-amber-700"
  return "text-muted-foreground"
}

const CLASSIFICATION_FILTERS = ["all", ...GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_CLASSIFICATIONS] as const

export function GrowthAiOsExecutionBoundaryAuditSection({
  audit,
}: {
  audit: GrowthLeadResearchExecutionBoundaryAuditReadModel
}) {
  const [classificationFilter, setClassificationFilter] =
    useState<(typeof CLASSIFICATION_FILTERS)[number]>("all")
  const [warningsOnly, setWarningsOnly] = useState(false)

  const filteredWorkflows = useMemo(() => {
    return audit.workflowReports.filter((report) => {
      if (classificationFilter !== "all" && report.classification !== classificationFilter) return false
      if (warningsOnly && report.missingGuardrails.length === 0 && report.futureExecutionAllowed) return false
      return true
    })
  }, [audit.workflowReports, classificationFilter, warningsOnly])

  const filteredPlans = useMemo(() => {
    if (!warningsOnly) return audit.planBoundaries
    return audit.planBoundaries.filter((plan) => !plan.futureExecutionAllowed || plan.boundaryWarnings.length > 0)
  }, [audit.planBoundaries, warningsOnly])

  return (
    <Card
      data-qa-marker={GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_QA_MARKER}
      data-qa-section="execution-boundary-audit"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="size-5 text-rose-600" />
          Execution Boundary Audit
        </CardTitle>
        <CardDescription>
          Read-only audit of future execution pathways — maps risks, guardrails, and allowed boundaries. No execution
          from this surface.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">{audit.systemSummary.headline}</p>
          <p className="mt-1 text-muted-foreground">
            System risk: {audit.systemSummary.systemRiskLevel} · Missing global guardrails:{" "}
            {audit.systemSummary.missingGlobalGuardrails.length}
          </p>
          {audit.systemSummary.missingGlobalGuardrails.length > 0 ? (
            <ul className="mt-2 list-disc pl-4 text-amber-700">
              {audit.systemSummary.missingGlobalGuardrails.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-muted-foreground self-center">Classification</span>
          {CLASSIFICATION_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={classificationFilter === filter ? "default" : "outline"}
              onClick={() => setClassificationFilter(filter)}
            >
              {filter.replaceAll("_", " ")}
            </Button>
          ))}
          <Button size="sm" variant={warningsOnly ? "default" : "outline"} onClick={() => setWarningsOnly((v) => !v)}>
            Warnings only
          </Button>
        </div>

        <div className="space-y-3">
          {filteredWorkflows.map((report) => (
            <div key={report.workflowType} className="rounded-lg border border-border/70 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{report.workflowType.replaceAll("_", " ")}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={classificationBadgeVariant(report.classification)}>
                    {report.classification.replaceAll("_", " ")}
                  </Badge>
                  {report.futureExecutionAllowed ? (
                    <Badge variant="secondary">Future allowed</Badge>
                  ) : (
                    <Badge variant="outline">Future blocked</Badge>
                  )}
                </div>
              </div>
              <p className="mt-2 text-muted-foreground">{report.auditSummary}</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                <p className={riskTone(report.outboundRisk)}>
                  Outbound risk: {report.outboundRisk}
                </p>
                <p className={riskTone(report.coreTouchRisk)}>
                  Core risk: {report.coreTouchRisk}
                </p>
                <p>
                  Safe Work Order: {report.safeWorkOrderType?.replaceAll("_", " ") ?? "None"}
                </p>
              </div>
              {report.missingGuardrails.length > 0 ? (
                <p className="mt-2 text-amber-700">
                  Missing guardrails: {report.missingGuardrails.join(" · ")}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">{report.notes}</p>
            </div>
          ))}
        </div>

        {filteredPlans.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Approved plan boundary status</p>
            {filteredPlans.map((plan) => (
              <div key={plan.planId} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{plan.companyName ?? plan.leadId.slice(0, 8)}</span>
                  <Badge variant={plan.futureExecutionAllowed ? "secondary" : "destructive"}>
                    {plan.futureExecutionAllowed ? "Boundary clear" : "Boundary blocked"}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{plan.boundarySummary}</p>
                {plan.boundaryWarnings.length > 0 ? (
                  <p className="mt-1 text-amber-700">{plan.boundaryWarnings[0]}</p>
                ) : null}
                <Link href={plan.observationHref} className="mt-1 inline-flex text-indigo-600 hover:text-indigo-700">
                  Open observation
                </Link>
              </div>
            ))}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Audit generated {new Date(audit.generatedAt).toLocaleString()} · read-only
        </p>
      </CardContent>
    </Card>
  )
}
