"use client"

import { useCallback, useEffect, useState } from "react"
import { GitBranch, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceWorkflowOrchestrationReadinessSnapshot } from "@/lib/voice/workflow-orchestration/types"
import { VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER } from "@/lib/voice/workflow-orchestration/types"

export function GrowthWorkflowOrchestrationReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceWorkflowOrchestrationReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/workflow-orchestration/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceWorkflowOrchestrationReadinessSnapshot }
      if (res.ok && data.readiness) setReadiness(data.readiness)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <section className={GROWTH_SETTINGS_SECTION_GAP}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </section>
    )
  }

  if (!readiness) return null

  return (
    <section
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-voice-workflow-orchestration-qa-marker={VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <GitBranch className="size-4" />
        Workflow Orchestration Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.orchestrationEnabled ? "Orchestration enabled" : "Orchestration disabled"}
            tone={readiness.orchestrationEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge label="Autonomous workflow execution disabled" tone="neutral" />
          <GrowthBadge
            label={readiness.stalledWorkflowDetectionReady ? "Stalled detection ready" : "Stalled detection pending"}
            tone={readiness.stalledWorkflowDetectionReady ? "healthy" : "neutral"}
          />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Escalation coordination: {readiness.escalationCoordinationReady ? "ready" : "pending"}</li>
          <li>Routing visibility: {readiness.routingVisibilityReady ? "ready" : "pending"}</li>
          <li>Workflow analytics: {readiness.workflowAnalyticsReady ? "ready" : "pending"}</li>
          <li>Multi-channel coordination: {readiness.multiChannelCoordinationReady ? "ready" : "pending"}</li>
          <li>Observability integration: {readiness.observabilityIntegrationReady ? "ready" : "pending"}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
        </ul>
      </div>
    </section>
  )
}
