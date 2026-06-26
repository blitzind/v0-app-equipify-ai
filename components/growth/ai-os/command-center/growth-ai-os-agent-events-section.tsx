"use client"

import { Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_AGENT_EVENT_QA_MARKER,
  type GrowthAgentEventsReadModel,
} from "@/lib/growth/aios/growth/growth-agent-event-types"

export function GrowthAiOsAgentEventsSection({
  agentEvents,
}: {
  agentEvents: GrowthAgentEventsReadModel
}) {
  return (
    <Card
      data-qa-marker={GROWTH_AGENT_EVENT_QA_MARKER}
      data-qa-section="agent-events"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="size-5 text-sky-600" />
          Agent Events
        </CardTitle>
        <CardDescription>{agentEvents.rule}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">
            Scheduling mode: {agentEvents.schedulingMode.replaceAll("_", " ")} · Scheduler{" "}
            {agentEvents.schedulerActive ? "active" : "inactive"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {agentEvents.summary.totalEvents} event(s) · Pending: {agentEvents.summary.pending} ·
            Blocked: {agentEvents.summary.blocked} · Recommendations:{" "}
            {agentEvents.summary.completedRecommendations}
          </p>
        </div>

        {agentEvents.latestEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agent events evaluated yet.</p>
        ) : (
          <div className="space-y-3">
            {agentEvents.latestEvents.map((row) => (
              <div key={row.eventId} className="rounded-lg border border-border/70 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {row.companyName ?? row.leadId ?? row.eventType.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.eventType.replaceAll("_", " ")} · {row.queueStatus.replaceAll("_", " ")}
                    </p>
                  </div>
                  <Badge variant="outline">{row.priority}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">Routed: {row.routedAgent.replaceAll("_", " ")}</Badge>
                  <Badge variant="outline">Owner: {row.owningAgent.replaceAll("_", " ")}</Badge>
                  <Badge variant="outline">
                    Escalation: {row.revenueOperator.escalationLevel}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground">{row.routingExplanation}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Recommendation: {row.revenueOperator.recommendation}
                </p>
                {row.blockedReasons.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-800">
                    Blocked: {row.blockedReasons.join(" · ")}
                  </p>
                ) : null}
                {row.revenueOperator.handoffPreview ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Handoff preview:{" "}
                    {row.revenueOperator.handoffPreview.sourceAgent.replaceAll("_", " ")} →{" "}
                    {row.revenueOperator.handoffPreview.destinationAgent.replaceAll("_", " ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
