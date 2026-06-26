"use client"

import Link from "next/link"
import { Bot } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthAutonomySettingsViewModel } from "@/lib/growth/autonomy/growth-autonomy-settings-service"

export function GrowthAutonomyAiOsIntegrationPanel({
  integration,
}: {
  integration: GrowthAutonomySettingsViewModel["aiOsIntegration"]
}) {
  return (
    <Card data-qa-section="autonomy-ai-os-integration">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="size-5 text-indigo-600" />
          AI OS integration
        </CardTitle>
        <CardDescription>
          Live read-only status from Agent Framework, Scheduler Readiness, and Autonomous Research — policy
          changes here apply across AI OS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border/70 p-3">
            <p className="font-medium">Scheduler readiness</p>
            <p className="text-muted-foreground">{integration.schedulerReadinessLabel}</p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <p className="font-medium">Agent framework</p>
            <p className="text-muted-foreground">{integration.agentFrameworkLabel}</p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <p className="font-medium">Research agent pilot</p>
            <p className="text-muted-foreground">{integration.researchPilotLabel}</p>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <p className="font-medium">Active autonomous agents</p>
            <Badge variant="secondary">{integration.activeAutonomousAgentCount}</Badge>
          </div>
        </div>
        <Link
          href={integration.operationsDashboardHref}
          className="inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Open AI Operations dashboard
        </Link>
      </CardContent>
    </Card>
  )
}
