"use client"

import Link from "next/link"
import { GitBranch, ShieldAlert, Sparkles, Target, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GrowthAiOsKpiCard } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils"
import type { AiOsCommandCenterGrowthLeadResearchWorkflow } from "@/lib/growth/aios/ai-os-command-center-types"
import { GROWTH_LEAD_RESEARCH_WORKFLOW_QA_MARKER } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { GROWTH_LEAD_RESEARCH_OPPORTUNITY_ASSESSMENT_QA_MARKER } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { cn } from "@/lib/utils"

function statusBadgeVariant(status: string) {
  if (status === "assessed" || status === "qualified") return "default" as const
  if (status === "researching" || status === "scheduled") return "secondary" as const
  if (status === "blocked" || status === "failed") return "destructive" as const
  return "outline" as const
}

function LeadWorkflowRow({
  lead,
  showOpportunity = false,
}: {
  lead: AiOsCommandCenterGrowthLeadResearchWorkflow["activeLeads"][number]
  showOpportunity?: boolean
}) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{lead.companyName ?? lead.leadId.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{lead.leadId.slice(0, 8)}…</p>
        </div>
        <Badge variant={statusBadgeVariant(lead.workflowStatus)}>{lead.workflowStatus.replaceAll("_", " ")}</Badge>
      </div>
      {showOpportunity ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
          <p>
            <span className="text-muted-foreground">Opportunity:</span>{" "}
            {lead.opportunityScore ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Confidence:</span>{" "}
            {lead.confidence != null ? `${Math.round(lead.confidence * 100)}%` : "—"}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Recommendation:</span>{" "}
            {lead.recommendation?.replaceAll("_", " ") ?? "—"}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Revenue:</span>{" "}
            {lead.estimatedRevenueRange ?? "—"}
          </p>
          {lead.risk ? (
            <p className="sm:col-span-2 text-amber-700">
              <span className="text-muted-foreground">Risk:</span> {lead.risk}
            </p>
          ) : null}
          {lead.nextBestAction ? (
            <p className="sm:col-span-2 font-medium text-foreground">
              Next best action: {lead.nextBestAction}
              {lead.priority ? ` · ${lead.priority} priority` : null}
            </p>
          ) : null}
          {lead.executionReadiness ? (
            <>
              <p>
                <span className="text-muted-foreground">Workflow:</span>{" "}
                {lead.workflowType?.replaceAll("_", " ") ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Readiness:</span>{" "}
                {lead.executionReadiness.replaceAll("_", " ")}
              </p>
              <p>
                <span className="text-muted-foreground">Duration:</span> {lead.estimatedDuration ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Cost:</span> {lead.estimatedCost ?? "—"}
              </p>
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Approval:</span>{" "}
                {lead.approvalRequired ? "Required before execution" : "Not required"}
              </p>
              {lead.missingPrerequisites.length > 0 ? (
                <p className="sm:col-span-2 text-amber-700">
                  Missing prerequisites: {lead.missingPrerequisites.join(" · ")}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <>
          {lead.fitScore != null ? (
            <p className="mt-2 text-sm text-muted-foreground">Fit score: {lead.fitScore}</p>
          ) : null}
          {lead.recommendedNextAction ? (
            <p className="mt-1 text-sm text-muted-foreground">Next: {lead.recommendedNextAction}</p>
          ) : null}
        </>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        <Link href={lead.observationHref} className="font-medium text-indigo-600 hover:text-indigo-700">
          Pilot observation
        </Link>
        <Link href={lead.leadsHref} className="font-medium text-indigo-600 hover:text-indigo-700">
          Leads
        </Link>
      </div>
    </div>
  )
}

export function GrowthAiOsGrowthLeadResearchWorkflowSection({
  workflow,
}: {
  workflow: AiOsCommandCenterGrowthLeadResearchWorkflow
}) {
  return (
    <section
      className="space-y-4"
      data-qa-section="growth-lead-research-workflow"
      data-qa-marker={GROWTH_LEAD_RESEARCH_WORKFLOW_QA_MARKER}
      aria-labelledby="growth-lead-research-workflow-heading"
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle id="growth-lead-research-workflow-heading" className="flex items-center gap-2 text-lg">
            <GitBranch className="size-5 text-emerald-600" />
            Growth Lead Research Workflow
          </CardTitle>
          <CardDescription>
            Canonical workflow <code className="text-xs">{workflow.workflowKey}</code> — human-supervised, feature-flagged.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={workflow.featureEnabled ? "secondary" : "outline"}>
              {workflow.featureEnabled ? "Enabled" : "Disabled (default OFF)"}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <GrowthAiOsKpiCard label="Researching" value={workflow.statusCounts.researching ?? 0} />
            <GrowthAiOsKpiCard label="Qualified" value={workflow.statusCounts.qualified ?? 0} />
            <GrowthAiOsKpiCard label="Assessed" value={workflow.statusCounts.assessed ?? 0} />
            <GrowthAiOsKpiCard label="Blocked" value={workflow.statusCounts.blocked ?? 0} />
            <GrowthAiOsKpiCard label="Failed" value={workflow.statusCounts.failed ?? 0} />
          </div>
        </CardContent>
      </Card>

      <Card data-qa-marker={GROWTH_LEAD_RESEARCH_OPPORTUNITY_ASSESSMENT_QA_MARKER}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-indigo-600" />
            Opportunity assessments
          </CardTitle>
          <CardDescription>Business-grade intelligence after qualification — advisory only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workflow.assessedLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assessed opportunities yet.</p>
          ) : (
            workflow.assessedLeads.map((lead) => (
              <LeadWorkflowRow key={lead.leadId} lead={lead} showOpportunity />
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-sky-600" />
              Active / in progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflow.activeLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads currently in research.</p>
            ) : (
              workflow.activeLeads.map((lead) => <LeadWorkflowRow key={lead.leadId} lead={lead} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-emerald-600" />
              Qualified / assessed leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflow.qualifiedLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No qualified leads yet.</p>
            ) : (
              workflow.qualifiedLeads.map((lead) => (
                <LeadWorkflowRow key={lead.leadId} lead={lead} showOpportunity={lead.workflowStatus === "assessed"} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-amber-200/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4 text-amber-600" />
              Blocked leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflow.blockedLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No blocked leads.</p>
            ) : (
              workflow.blockedLeads.map((lead) => <LeadWorkflowRow key={lead.leadId} lead={lead} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Next best actions</CardTitle>
            <CardDescription>Recommendation only — no Work Order execution from this surface.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflow.recommendedNextActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recommendations yet.</p>
            ) : (
              workflow.recommendedNextActions.map((item) => (
                <div key={item.leadId} className="rounded-lg border border-border/70 p-3">
                  <p className="font-medium">{item.companyName ?? item.leadId.slice(0, 8)}</p>
                  <p className="mt-1 text-sm">{item.action}</p>
                  {item.priority ? (
                    <p className="mt-1 text-xs text-muted-foreground">Priority: {item.priority}</p>
                  ) : null}
                  {item.workOrderType ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Future Work Order hint: {item.workOrderType.replaceAll("_", " ")}
                    </p>
                  ) : null}
                  <p className={cn("mt-1 text-sm text-muted-foreground")}>{item.reason}</p>
                  <Link
                    href={item.observationHref}
                    className="mt-2 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Pilot observation
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
