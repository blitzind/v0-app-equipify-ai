"use client"

import { Brain } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_AGENT_MEMORY_QA_MARKER,
  type GrowthAgentMemoryReadModel,
} from "@/lib/growth/aios/growth/growth-agent-memory-types"

export function GrowthAiOsAgentMemorySection({
  agentMemory,
}: {
  agentMemory: GrowthAgentMemoryReadModel
}) {
  return (
    <Card
      data-qa-marker={GROWTH_AGENT_MEMORY_QA_MARKER}
      data-qa-section="agent-memory"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="size-5 text-violet-600" />
          Agent Memory
        </CardTitle>
        <CardDescription>{agentMemory.rule}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">
            {agentMemory.summary.leadsIndexed} lead(s) indexed · Complete:{" "}
            {agentMemory.summary.complete} · Partial: {agentMemory.summary.partial} · Blocked:{" "}
            {agentMemory.summary.blocked}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Conflicts detected: {agentMemory.summary.conflictsDetected}
          </p>
        </div>

        {agentMemory.leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shared memory records yet.</p>
        ) : (
          <div className="space-y-3">
            {agentMemory.leads.map(({ sharedMemory }) => (
              <div
                key={sharedMemory.memoryId}
                className="rounded-lg border border-border/70 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {sharedMemory.companyName ?? sharedMemory.leadId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Completeness: {sharedMemory.completenessState.replaceAll("_", " ")}
                    </p>
                  </div>
                  {sharedMemory.confidence != null ? (
                    <Badge variant="outline">
                      {Math.round(sharedMemory.confidence * 100)}% confidence
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Owner: {sharedMemory.owningAgent.replaceAll("_", " ")}
                  </Badge>
                  {sharedMemory.workflowType ? (
                    <Badge variant="outline">
                      {sharedMemory.workflowType.replaceAll("_", " ")}
                    </Badge>
                  ) : null}
                </div>
                {sharedMemory.revenueOperatorRecommendation ? (
                  <p className="mt-2 text-muted-foreground">
                    Revenue Operator: {sharedMemory.revenueOperatorRecommendation}
                  </p>
                ) : null}
                {sharedMemory.missingFields.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-800">
                    Missing: {sharedMemory.missingFields.join(" · ")}
                  </p>
                ) : null}
                {sharedMemory.conflicts.length > 0 ? (
                  <p className="mt-1 text-xs text-rose-800">
                    Conflicts: {sharedMemory.conflicts.map((c) => c.summary).join(" · ")}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Remediation: {sharedMemory.recommendedRemediation}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
