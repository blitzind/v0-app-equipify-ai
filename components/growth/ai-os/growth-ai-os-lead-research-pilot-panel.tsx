"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { LeadResearchPilotObservation, LeadResearchPilotStepRecord } from "@/lib/growth/aios/pilot/lead-research-pilot-types"
import { GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER } from "@/lib/growth/aios/pilot/lead-research-pilot-types"
import { GrowthAiOsLeadResearchExecutionPlanSection } from "@/components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section"
import { buildAiOsMissionPlanningHref } from "@/lib/growth/aios/ai-os-mission-route-params"

function stepBadgeVariant(status: LeadResearchPilotStepRecord["status"]) {
  switch (status) {
    case "completed":
      return "default" as const
    case "running":
      return "secondary" as const
    case "failed":
      return "destructive" as const
    case "skipped":
      return "outline" as const
    default:
      return "outline" as const
  }
}

export function GrowthAiOsLeadResearchPilotPanel({ leadId }: { leadId: string }) {
  const [observation, setObservation] = useState<LeadResearchPilotObservation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const response = await fetch(`/api/platform/growth/ai-os/pilot/lead-research/${leadId}`, {
      cache: "no-store",
    })
    const body = (await response.json()) as {
      ok?: boolean
      observation?: LeadResearchPilotObservation
      message?: string
      error?: string
    }
    if (!response.ok || !body.ok || !body.observation) {
      throw new Error(body.message ?? body.error ?? "Could not load pilot observation.")
    }
    setObservation(body.observation)
    setError(null)
  }, [leadId])

  useEffect(() => {
    void load()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load pilot observation.")
      })
      .finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (!observation?.pilotEnabled) return
    const pending = observation.steps.some((step) => step.status === "running" || step.status === "pending")
    if (!pending) return

    const timer = window.setInterval(() => {
      void load().catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [load, observation])

  if (loading && !observation) {
    return <p className="text-sm text-muted-foreground">Loading Lead Research Pilot observation…</p>
  }

  if (error && !observation) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!observation) return null

  const missionPlanningHref = buildAiOsMissionPlanningHref(observation.missionId)

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER} data-lead-id={leadId}>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Lead Research Pilot
            <Badge variant={observation.pilotEnabled ? "default" : "outline"}>
              {observation.pilotEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </CardTitle>
          <CardDescription>
            End-to-end AI OS observation for prospect → planning → research Work Order → decision prep → context →
            provider → saved research → completion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Company:</span> {observation.companyName ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Lead ID:</span>{" "}
            <span className="font-mono text-xs">{leadId}</span>
          </p>
          {missionPlanningHref ? (
            <p>
              <span className="text-muted-foreground">Mission:</span>{" "}
              <Link className="underline" href={missionPlanningHref}>
                {observation.missionId!.slice(0, 8)}… planning review
              </Link>
            </p>
          ) : null}
          {observation.workOrderId ? (
            <p>
              <span className="text-muted-foreground">Work Order:</span>{" "}
              <span className="font-mono text-xs">{observation.workOrderId}</span>
            </p>
          ) : null}
          {observation.researchRunId ? (
            <p>
              <span className="text-muted-foreground">Research run:</span>{" "}
              <span className="font-mono text-xs">{observation.researchRunId}</span>
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">AI evidence (decision prep):</span>{" "}
            {observation.enableAiEvidence ? "opt-in enabled" : "off"}
          </p>
          <p>
            <span className="text-muted-foreground">Workflow:</span>{" "}
            <Badge variant="secondary">{observation.workflowKey}</Badge>{" "}
            <Badge variant="outline">{observation.workflowStatus.replaceAll("_", " ")}</Badge>
          </p>
          {observation.qualification ? (
            <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-1">
              <p className="font-medium">Qualification</p>
              <p>Fit score: {observation.qualification.fitScore}</p>
              <p>Confidence: {Math.round(observation.qualification.confidence * 100)}%</p>
              <p>Next: {observation.qualification.recommendedNextAction}</p>
              {observation.recommendedWorkOrderType ? (
                <p className="text-xs text-muted-foreground">
                  Suggested Work Order: {observation.recommendedWorkOrderType.replaceAll("_", " ")}
                </p>
              ) : null}
              <p className="text-muted-foreground">{observation.qualification.reason}</p>
              {observation.qualification.missingEvidence.length > 0 ? (
                <ul className="list-disc pl-4 text-xs text-muted-foreground">
                  {observation.qualification.missingEvidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {observation.opportunityAssessment ? (
            <div className="rounded-md border border-indigo-200/70 bg-indigo-50/40 p-3 space-y-1">
              <p className="font-medium">Opportunity Assessment</p>
              <p>Opportunity score: {observation.opportunityAssessment.opportunityScore}</p>
              <p>Recommendation: {observation.opportunityAssessment.recommendation.replaceAll("_", " ")}</p>
              <p>Revenue: {observation.opportunityAssessment.estimatedRevenueRange}</p>
              <p>Sales cycle: {observation.opportunityAssessment.estimatedSalesCycle}</p>
              <p className="text-muted-foreground">{observation.opportunityAssessment.summary}</p>
            </div>
          ) : null}
          {observation.nextBestAction ? (
            <div className="rounded-md border border-border/70 p-3 space-y-1">
              <p className="font-medium">Next Best Action</p>
              <p>{observation.nextBestAction.label}</p>
              <p className="text-sm text-muted-foreground">{observation.nextBestAction.reason}</p>
              <p className="text-xs text-muted-foreground">
                Priority: {observation.nextBestAction.priority} · Urgency: {observation.nextBestAction.urgency}
              </p>
            </div>
          ) : null}
          {observation.evidenceSummary ? (
            <div className="rounded-md border border-border/70 p-3 space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-sm text-foreground">Evidence summary</p>
              {observation.evidenceSummary.potentialRisks.length > 0 ? (
                <p>Risks: {observation.evidenceSummary.potentialRisks.join("; ")}</p>
              ) : null}
              {observation.evidenceSummary.missingEvidence.length > 0 ? (
                <p>Missing: {observation.evidenceSummary.missingEvidence.join("; ")}</p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/growth/leads/${leadId}`}>Back to lead</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {observation.executionPlan ? (
        <GrowthAiOsLeadResearchExecutionPlanSection
          plan={observation.executionPlan}
          title="Planning Review"
          description="Recommended workflow and execution plan — read-only, no Work Order creation."
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Pipeline steps</CardTitle>
          <CardDescription>Operator-visible step trace emitted by the pilot orchestrator.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {observation.steps.map((step) => (
            <div key={step.stepId} className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2">
              <div>
                <p className="font-medium">{step.label}</p>
                {step.detail ? <p className="text-xs text-muted-foreground">{step.detail}</p> : null}
              </div>
              <Badge variant={stepBadgeVariant(step.status)}>{step.status}</Badge>
            </div>
          ))}
          {observation.lastError ? (
            <p className="text-sm text-destructive">Last error: {observation.lastError}</p>
          ) : null}
        </CardContent>
      </Card>

      {!observation.pilotEnabled ? (
        <p className="text-sm text-muted-foreground">
          Set <code className="font-mono text-xs">GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED=true</code> to activate the
          pilot on new prospects.
        </p>
      ) : null}
    </div>
  )
}
