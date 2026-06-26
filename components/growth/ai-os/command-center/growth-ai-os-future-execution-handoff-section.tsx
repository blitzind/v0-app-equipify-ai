"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { FileOutput } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_QA_MARKER,
  GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_STATES,
  type GrowthLeadResearchFutureExecutionHandoffContract,
  type GrowthLeadResearchFutureExecutionHandoffState,
} from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"

function handoffBadgeVariant(state: GrowthLeadResearchFutureExecutionHandoffState) {
  if (state === "handoff_ready") return "secondary" as const
  if (state.startsWith("handoff_blocked_")) return "destructive" as const
  return "outline" as const
}

const HANDOFF_FILTERS = ["all", ...GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_STATES] as const

export function GrowthAiOsFutureExecutionHandoffSection({
  handoffContracts,
}: {
  handoffContracts: GrowthLeadResearchFutureExecutionHandoffContract[]
}) {
  const [handoffFilter, setHandoffFilter] = useState<(typeof HANDOFF_FILTERS)[number]>("all")
  const [readyOnly, setReadyOnly] = useState(false)

  const filteredContracts = useMemo(() => {
    return handoffContracts.filter((item) => {
      if (readyOnly && item.handoffState !== "handoff_ready") return false
      if (handoffFilter !== "all" && item.handoffState !== handoffFilter) return false
      return true
    })
  }, [handoffContracts, handoffFilter, readyOnly])

  return (
    <Card
      data-qa-marker={GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_QA_MARKER}
      data-qa-section="future-execution-handoff"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileOutput className="size-5 text-violet-600" />
          Future Execution Handoff
        </CardTitle>
        <CardDescription>
          Read-only handoff contract — specifies what a future execution phase would require. No Work Orders are
          created from this surface.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-muted-foreground self-center">Handoff</span>
          {HANDOFF_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={handoffFilter === filter ? "default" : "outline"}
              onClick={() => setHandoffFilter(filter)}
            >
              {filter.replaceAll("_", " ")}
            </Button>
          ))}
          <Button size="sm" variant={readyOnly ? "default" : "outline"} onClick={() => setReadyOnly((v) => !v)}>
            Handoff ready only
          </Button>
        </div>

        {filteredContracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {handoffContracts.length === 0
              ? "No operator-approved execution plans with handoff contracts yet."
              : "No handoff contracts match the current filters."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredContracts.map((contract) => (
              <div key={contract.planId} className="rounded-lg border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{contract.companyName ?? contract.leadId.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{contract.planId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{contract.recommendedWorkflow.replaceAll("_", " ")}</Badge>
                    <Badge variant={handoffBadgeVariant(contract.handoffState)}>
                      {contract.handoffState.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </div>

                <p className="mt-3 text-sm">{contract.handoffSummary}</p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Expected Work Order:</span>{" "}
                    {contract.expectedWorkOrderType?.replaceAll("_", " ") ?? "None (blocked or N/A)"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Generated:</span>{" "}
                    {new Date(contract.generatedAt).toLocaleString()}
                  </p>
                </div>

                {contract.blockedReasons.length > 0 ? (
                  <div className="mt-3 text-sm text-amber-700">
                    <p className="font-medium">Blocked reasons</p>
                    <ul className="mt-1 list-disc pl-4">
                      {contract.blockedReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-3 grid gap-3 lg:grid-cols-2 text-sm">
                  <div>
                    <p className="font-medium">Required inputs</p>
                    <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                      {contract.requiredInputs.slice(0, 5).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Required evidence</p>
                    <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                      {contract.requiredEvidence.slice(0, 5).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Required approvals</p>
                    <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                      {contract.requiredApprovals.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium">Provider capabilities</p>
                    <p className="mt-1 text-muted-foreground">
                      {contract.requiredProviderCapabilities.map((item) => item.replaceAll("_", " ")).join(" · ")}
                    </p>
                  </div>
                </div>

                <div className="mt-3 text-sm">
                  <p className="font-medium">Required guardrails</p>
                  <p className="mt-1 text-muted-foreground">
                    {contract.requiredGuardrails.map((item) => item.replaceAll("_", " ")).join(" · ")}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Rollback:</span> {contract.rollbackRequirements}
                  </p>
                  {contract.auditReferences.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Audit references: {contract.auditReferences.slice(-3).join(", ")}
                    </p>
                  ) : null}
                </div>

                <Link
                  href={contract.observationHref}
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
