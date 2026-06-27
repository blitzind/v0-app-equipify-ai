"use client"

import Link from "next/link"
import { GrowthAiOsRevenueDirectorDispatchButton } from "@/components/growth/ai-os/command-center/growth-ai-os-revenue-director-dispatch-button"
import { Badge } from "@/components/ui/badge"
import type { GrowthRevenueDirectorReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { GROWTH_REVENUE_DIRECTOR_QA_MARKER } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"

type Props = {
  revenueDirector: GrowthRevenueDirectorReadModel
  compact?: boolean
}

function healthBadgeVariant(health: string) {
  if (health === "on_pace" || health === "healthy" || health === "enabled") return "secondary" as const
  if (health === "at_risk" || health === "degraded" || health === "restricted") return "outline" as const
  return "destructive" as const
}

export function GrowthAiOsRevenueDirectorSection({ revenueDirector, compact }: Props) {
  if (revenueDirector.qaMarker !== GROWTH_REVENUE_DIRECTOR_QA_MARKER) return null

  const { executiveSummary, kpis, workflowRequests, bottlenecks, risks, decisionLedger } = revenueDirector

  const ledgerSummary = decisionLedger?.summary

  return (
    <section data-qa-section="revenue-director" className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Revenue Director</h3>
          <p className="text-xs text-muted-foreground">
            Executive orchestration — accepted requests can dispatch to Workflow Agents (no direct send).
          </p>
        </div>
        <Badge variant={healthBadgeVariant(executiveSummary.revenueHealth)}>
          {executiveSummary.revenueHealth.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3">
        <p className="text-sm font-medium">{executiveSummary.headline}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {executiveSummary.onPace ? "On pace" : "Off pace"}
          {executiveSummary.shouldIntervene ? " · Human intervention recommended" : ""}
          {executiveSummary.shouldPauseOutbound ? " · Outbound pause advised" : ""}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Approval backlog</p>
          <p className="text-sm font-medium">{kpis.approvalBacklog}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Active scopes</p>
          <p className="text-sm font-medium">{kpis.activeAutonomousScopes}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Communication mix</p>
          <p className="text-sm font-medium">
            {revenueDirector.resourceAllocation.communicationTopChannel ?? "—"}
          </p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Workflow requests</p>
          <p className="text-sm font-medium">{workflowRequests.length}</p>
        </div>
      </div>

      {revenueDirector.learningAdvisory?.topInsight ? (
        <div className="rounded-md border border-dashed border-indigo-200 bg-indigo-50/30 p-3">
          <p className="text-xs font-medium text-indigo-900">Learning insight (advisory)</p>
          <p className="text-sm">{revenueDirector.learningAdvisory.topInsight.title}</p>
          <p className="text-xs text-muted-foreground">{revenueDirector.learningAdvisory.topInsight.summary}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Risk trend: {revenueDirector.learningAdvisory.riskTrend}</span>
            {revenueDirector.learningAdvisory.channelTrend ? (
              <span>Channel: {revenueDirector.learningAdvisory.channelTrend}</span>
            ) : null}
            {revenueDirector.learningAdvisory.approvalFriction != null ? (
              <span>Approval friction: {Math.round(revenueDirector.learningAdvisory.approvalFriction * 100)}%</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {ledgerSummary ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-md border border-dashed p-2">
            <p className="text-xs text-muted-foreground">Pending decisions</p>
            <p className="text-sm font-medium">{ledgerSummary.pendingDecisions}</p>
          </div>
          <div className="rounded-md border border-dashed p-2">
            <p className="text-xs text-muted-foreground">Pending requests</p>
            <p className="text-sm font-medium">{ledgerSummary.pendingRequests}</p>
          </div>
          <div className="rounded-md border border-dashed p-2">
            <p className="text-xs text-muted-foreground">Accepted</p>
            <p className="text-sm font-medium">{ledgerSummary.acceptedRequests}</p>
          </div>
          <div className="rounded-md border border-dashed p-2">
            <p className="text-xs text-muted-foreground">Completed / superseded</p>
            <p className="text-sm font-medium">
              {ledgerSummary.completedCount} / {ledgerSummary.supersededCount}
            </p>
          </div>
          <div className="rounded-md border border-dashed p-2">
            <p className="text-xs text-muted-foreground">Top recommended</p>
            <p className="text-sm font-medium truncate">
              {ledgerSummary.topRecommendedRequestTitle ?? "—"}
            </p>
          </div>
        </div>
      ) : null}

      {!decisionLedger?.schemaReady ? (
        <p className="text-xs text-muted-foreground">Decision ledger schema not ready — advisory mode only.</p>
      ) : null}

      {bottlenecks.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Top bottlenecks</p>
          <ul className="mt-1 space-y-1">
            {bottlenecks.slice(0, compact ? 2 : 4).map((item) => (
              <li key={item.id} className="text-xs text-muted-foreground">
                {item.label} — {item.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {workflowRequests.length > 0 ? (
        <ul className="space-y-2">
          {workflowRequests.slice(0, compact ? 3 : 5).map((request) => (
            <li key={request.id} className="rounded-md border p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{request.title}</p>
                  <p className="text-xs text-muted-foreground">{request.summary}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{request.requestType.replace(/_/g, " ")}</Badge>
                  <Badge variant="secondary">P{request.priorityScore}</Badge>
                  {request.advisory ? <Badge variant="outline">Advisory</Badge> : null}
                  {request.ledgerStatus ? (
                    <Badge variant={request.ledgerStatus === "new" ? "default" : "outline"}>
                      {request.ledgerStatus.replace(/_/g, " ")}
                    </Badge>
                  ) : null}
                  {request.isStale ? <Badge variant="destructive">Stale</Badge> : null}
                </div>
              </div>
              {request.routeHint ? (
                <Link href={request.routeHint} className="mt-1 inline-block text-xs text-primary hover:underline">
                  Open route
                </Link>
              ) : null}
              {request.correlationStatus === "pending" ? (
                <Badge variant="outline">Awaiting agent completion</Badge>
              ) : null}
              {request.correlationStatus === "stale" ? (
                <Badge variant="destructive">Stale dispatch</Badge>
              ) : null}
              {request.correlationStatus === "completed" && request.correlationResultReference ? (
                <p className="text-xs text-muted-foreground">
                  Result: {request.correlationResultReference.type}
                  {request.correlationResultReference.id ? ` · ${request.correlationResultReference.id}` : ""}
                </p>
              ) : null}
              {request.correlationFailureReason ? (
                <p className="text-xs text-destructive">{request.correlationFailureReason}</p>
              ) : null}
              {request.ledgerRequestId ? (
                <GrowthAiOsRevenueDirectorDispatchButton request={request} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No advisory workflow requests in the current snapshot.</p>
      )}

      {risks.length > 0 && !compact ? (
        <p className="text-xs text-muted-foreground">
          Risks: {risks.map((risk) => risk.label).join(", ")}
        </p>
      ) : null}
    </section>
  )
}
