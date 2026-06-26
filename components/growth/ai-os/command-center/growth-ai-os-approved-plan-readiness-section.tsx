"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_QA_MARKER,
  GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_STATES,
  type GrowthLeadResearchApprovedPlanReadinessItem,
  type GrowthLeadResearchApprovedPlanReadinessState,
} from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"

function readinessStateBadgeVariant(state: GrowthLeadResearchApprovedPlanReadinessState) {
  if (state === "ready_for_future_execution") return "secondary" as const
  if (state.startsWith("blocked_")) return "destructive" as const
  return "outline" as const
}

const READINESS_FILTERS = ["all", ...GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_STATES] as const

export function GrowthAiOsApprovedPlanReadinessSection({
  approvedPlans,
}: {
  approvedPlans: GrowthLeadResearchApprovedPlanReadinessItem[]
}) {
  const [readinessFilter, setReadinessFilter] = useState<(typeof READINESS_FILTERS)[number]>("all")
  const [showMissingPrerequisitesOnly, setShowMissingPrerequisitesOnly] = useState(false)

  const filteredPlans = useMemo(() => {
    return approvedPlans.filter((item) => {
      if (readinessFilter !== "all" && item.readinessState !== readinessFilter) return false
      if (showMissingPrerequisitesOnly && item.missingPrerequisites.length === 0) return false
      return true
    })
  }, [approvedPlans, readinessFilter, showMissingPrerequisitesOnly])

  return (
    <Card
      data-qa-marker={GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_QA_MARKER}
      data-qa-section="approved-plan-readiness"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-5 text-teal-600" />
          Approved Plan Readiness
        </CardTitle>
        <CardDescription>
          Read-only readiness and audit trail for operator-approved execution plans — no execution from this surface.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-muted-foreground self-center">Readiness</span>
          {READINESS_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={readinessFilter === filter ? "default" : "outline"}
              onClick={() => setReadinessFilter(filter)}
            >
              {filter.replaceAll("_", " ")}
            </Button>
          ))}
          <Button
            size="sm"
            variant={showMissingPrerequisitesOnly ? "default" : "outline"}
            onClick={() => setShowMissingPrerequisitesOnly((value) => !value)}
          >
            Missing prerequisites
          </Button>
        </div>

        {filteredPlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {approvedPlans.length === 0
              ? "No operator-approved execution plans yet."
              : "No approved plans match the current filters."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredPlans.map((item) => (
              <div key={item.planId} className="rounded-lg border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.companyName ?? item.leadId.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{item.planId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{item.recommendedWorkflow.replaceAll("_", " ")}</Badge>
                    <Badge variant="secondary">{item.approvalState.replaceAll("_", " ")}</Badge>
                    <Badge variant={readinessStateBadgeVariant(item.readinessState)}>
                      {item.readinessState.replaceAll("_", " ")}
                    </Badge>
                    {item.futureExecutionEligible ? (
                      <Badge variant="secondary">Future eligible</Badge>
                    ) : (
                      <Badge variant="outline">Future blocked</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Duration:</span> {item.estimatedDuration}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Cost:</span> {item.estimatedCost}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Confidence:</span>{" "}
                    {item.confidence != null ? `${Math.round(item.confidence * 100)}%` : "—"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Readiness:</span> {item.readinessReason}
                  </p>
                  {item.missingPrerequisites.length > 0 ? (
                    <p className="sm:col-span-2 text-amber-700">
                      Missing prerequisites: {item.missingPrerequisites.join(" · ")}
                    </p>
                  ) : null}
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Future phase:</span> {item.futureExecutionSummary}
                  </p>
                  {item.lastReviewedAt ? (
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Last review {new Date(item.lastReviewedAt).toLocaleString()}
                      {item.lastReviewAction ? ` · ${item.lastReviewAction.replaceAll("_", " ")}` : null}
                    </p>
                  ) : null}
                </div>

                {item.evidenceSummary ? (
                  <div className="mt-3 text-sm">
                    <p className="font-medium">Evidence summary</p>
                    {item.evidenceSummary.verifiedEvidence.length > 0 ? (
                      <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                        {item.evidenceSummary.verifiedEvidence.slice(0, 4).map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">No verified evidence recorded.</p>
                    )}
                    {item.evidenceSummary.potentialRisks.length > 0 ? (
                      <p className="mt-2 text-amber-700">
                        Risks: {item.evidenceSummary.potentialRisks.slice(0, 3).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {item.auditTrail.entries.length > 0 ? (
                  <div className="mt-3 text-sm">
                    <p className="font-medium">Audit trail</p>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {item.auditTrail.entries.slice(-5).map((entry) => (
                        <li key={entry.eventId}>
                          {new Date(entry.occurredAt).toLocaleString()} · {entry.summary}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Link
                  href={item.observationHref}
                  className="mt-3 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Open observation
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
