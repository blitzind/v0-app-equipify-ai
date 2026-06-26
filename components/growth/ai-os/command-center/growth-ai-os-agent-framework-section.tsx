"use client"

import { Bot } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_AGENT_FRAMEWORK_QA_MARKER,
  type GrowthAgentFrameworkReadModel,
  type GrowthAgentStatus,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"

function statusBadgeVariant(status: GrowthAgentStatus) {
  if (status === "idle") return "secondary" as const
  if (status === "running" || status === "scheduled") return "default" as const
  if (status === "disabled" || status === "paused") return "outline" as const
  return "destructive" as const
}

export function GrowthAiOsAgentFrameworkSection({
  agentFramework,
}: {
  agentFramework: GrowthAgentFrameworkReadModel
}) {
  return (
    <Card
      data-qa-marker={GROWTH_AGENT_FRAMEWORK_QA_MARKER}
      data-qa-section="agent-framework"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="size-5 text-violet-600" />
          Agent Framework
        </CardTitle>
        <CardDescription>{agentFramework.rule}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">
            {agentFramework.summary.totalAgents} agents defined · {agentFramework.summary.disabledAgents} disabled ·
            Scheduler {agentFramework.schedulerActive ? "active" : "inactive (4A placeholder only)"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dry-run eligible: {agentFramework.summary.dryRunEligibleAgents} · Internal runtime eligible:{" "}
            {agentFramework.summary.internalRuntimeEligibleAgents} · Outbound blocked:{" "}
            {agentFramework.summary.outboundBlockedAgents}
          </p>
        </div>

        <div className="space-y-3">
          {agentFramework.agents.map((agent) => (
            <div key={agent.agentId} className="rounded-lg border border-border/70 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{agent.agentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {agent.agentKind.replaceAll("_", " ")} · {agent.agentId}
                  </p>
                </div>
                <Badge variant={statusBadgeVariant(agent.status)}>{agent.status.replaceAll("_", " ")}</Badge>
              </div>
              <p className="mt-2 text-muted-foreground">{agent.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{agent.permissionProfile.replaceAll("_", " ")}</Badge>
                <Badge variant="outline">Scheduler: {agent.schedulerMode}</Badge>
                {agent.capabilities.dryRunEligible ? <Badge variant="secondary">Dry-run eligible</Badge> : null}
                {agent.capabilities.internalRuntimeEligible ? (
                  <Badge variant="secondary">Internal runtime eligible</Badge>
                ) : null}
                {agent.capabilities.definitionOnly ? <Badge variant="outline">Definition only</Badge> : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Workflows: {agent.allowedWorkflowTypes.map((w) => w.replaceAll("_", " ")).join(", ")}
              </p>
              {agent.blockedCapabilities.length > 0 ? (
                <p className="mt-1 text-xs text-amber-800">
                  Blocked: {agent.blockedCapabilities.join(" · ")}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">{agent.lastRunSummary}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Telemetry — runs: {agent.telemetry.runCount} · blocked: {agent.telemetry.blockedCount} · provider:{" "}
                {agent.telemetry.providerCallCount} · outbound: {agent.telemetry.outboundAttemptedCount} · Core:{" "}
                {agent.telemetry.coreMutationCount}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
