"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ListChecks } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_STATUSES,
  type GrowthLeadResearchExecutionPreflightReadModel,
  type GrowthLeadResearchExecutionPreflightStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"

function preflightBadgeVariant(status: GrowthLeadResearchExecutionPreflightStatus) {
  if (status === "preflight_passed") return "secondary" as const
  if (status === "preflight_not_allowed") return "outline" as const
  return "destructive" as const
}

const STATUS_FILTERS = ["all", ...GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_STATUSES] as const

export function GrowthAiOsExecutionPreflightChecklistSection({
  preflight,
}: {
  preflight: GrowthLeadResearchExecutionPreflightReadModel
}) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all")
  const [blockedOnly, setBlockedOnly] = useState(false)

  const filteredWorkflows = useMemo(() => {
    return preflight.workflowChecklists.filter((row) => {
      if (blockedOnly && row.runtimeImplementationAllowed) return false
      if (statusFilter !== "all" && row.preflightStatus !== statusFilter) return false
      return true
    })
  }, [blockedOnly, preflight.workflowChecklists, statusFilter])

  const filteredPlans = useMemo(() => {
    if (!blockedOnly) return preflight.planChecklists
    return preflight.planChecklists.filter((plan) => !plan.runtimeImplementationAllowed)
  }, [blockedOnly, preflight.planChecklists])

  return (
    <Card
      data-qa-marker={GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_QA_MARKER}
      data-qa-section="execution-preflight-checklist"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListChecks className="size-5 text-sky-600" />
          Execution Preflight Checklist
        </CardTitle>
        <CardDescription>
          Guardrail preflight audit — verifies readiness before any future runtime implementation. No execution from
          this surface.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">{preflight.systemSummary.headline}</p>
          <p className="mt-1 text-muted-foreground">
            Passed: {preflight.systemSummary.preflightPassedCount} · Blocked: {preflight.systemSummary.blockedCount} ·
            Not allowed: {preflight.systemSummary.notAllowedCount}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-muted-foreground self-center">Status</span>
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={statusFilter === filter ? "default" : "outline"}
              onClick={() => setStatusFilter(filter)}
            >
              {filter.replaceAll("_", " ")}
            </Button>
          ))}
          <Button size="sm" variant={blockedOnly ? "default" : "outline"} onClick={() => setBlockedOnly((v) => !v)}>
            Blocked only
          </Button>
        </div>

        <div className="space-y-3">
          {filteredWorkflows.map((checklist) => (
            <div key={checklist.workflowType} className="rounded-lg border border-border/70 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{checklist.workflowType.replaceAll("_", " ")}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{checklist.boundaryClassification.replaceAll("_", " ")}</Badge>
                  <Badge variant={preflightBadgeVariant(checklist.preflightStatus)}>
                    {checklist.preflightStatus.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 text-muted-foreground">{checklist.preflightSummary}</p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                <p>Provider check: {checklist.requiredProviderHealthCheck ? (checklist.providerHealthReady ? "ready" : "missing") : "n/a"}</p>
                <p>Human confirmation: {checklist.requiredHumanConfirmationLevel.replaceAll("_", " ")}</p>
                <p>Core risk: {checklist.coreRiskStatus}</p>
                <p>Outbound risk: {checklist.outboundRiskStatus}</p>
              </div>
              {checklist.missingRequirements.length > 0 ? (
                <ul className="mt-2 list-disc pl-4 text-amber-700">
                  {checklist.missingRequirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Runtime implementation: {checklist.runtimeImplementationAllowed ? "allowed" : "blocked"}
              </p>
            </div>
          ))}
        </div>

        {filteredPlans.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Approved plan preflight</p>
            {filteredPlans.map((plan) => (
              <div key={plan.planId} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{plan.companyName ?? plan.leadId.slice(0, 8)}</span>
                  <Badge variant={preflightBadgeVariant(plan.preflightStatus)}>
                    {plan.preflightStatus.replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{plan.preflightSummary}</p>
                <Link href={plan.observationHref} className="mt-1 inline-flex text-indigo-600 hover:text-indigo-700">
                  Open observation
                </Link>
              </div>
            ))}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Preflight generated {new Date(preflight.generatedAt).toLocaleString()} · read-only
        </p>
      </CardContent>
    </Card>
  )
}
