"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { LeadResearchPilotObservation, LeadResearchPilotStepRecord } from "@/lib/growth/aios/pilot/lead-research-pilot-types"
import { GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER } from "@/lib/growth/aios/pilot/lead-research-pilot-types"
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
