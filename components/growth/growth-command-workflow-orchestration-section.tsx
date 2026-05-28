"use client"

import { useCallback, useEffect, useState } from "react"
import { GitBranch } from "lucide-react"
import Link from "next/link"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { VoiceWorkflowOrchestrationCommandSummary } from "@/lib/voice/workflow-orchestration/types"
import { VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER } from "@/lib/voice/workflow-orchestration/types"

export function GrowthCommandWorkflowOrchestrationSection() {
  const [summary, setSummary] = useState<VoiceWorkflowOrchestrationCommandSummary | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/growth/voice/workflow-orchestration/command-summary", { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { summary?: VoiceWorkflowOrchestrationCommandSummary }
    if (res.ok && data.summary) setSummary(data.summary)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!summary) return null

  const hasActivity =
    summary.activeCount > 0 ||
    summary.stalledCount > 0 ||
    summary.escalatedCount > 0 ||
    summary.complianceHoldCount > 0

  if (!hasActivity) return null

  return (
    <GrowthEngineCard
      id="cc-workflow-orchestration"
      icon={GitBranch}
      title="Workflow Orchestration"
      subtitle="Cross-system coordination — operator-controlled, no autonomous execution."
      data-voice-workflow-orchestration-qa-marker={VOICE_WORKFLOW_ORCHESTRATION_QA_MARKER}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <GrowthBadge label="Visibility only" tone="neutral" />
        <GrowthBadge label="No auto-reassignment" tone="neutral" />
        {summary.stalledCount > 0 ? (
          <GrowthBadge label={`${summary.stalledCount} stalled`} tone="attention" />
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active workflows" value={String(summary.activeCount)} />
        <StatTile label="Stalled" value={String(summary.stalledCount)} />
        <StatTile label="Escalated" value={String(summary.escalatedCount)} />
        <StatTile label="Awaiting operator" value={String(summary.awaitingOperatorCount)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <Link href="/admin/growth/settings/voice" className="underline underline-offset-2">
          Open voice settings
        </Link>{" "}
        to review workflow orchestration workspace and routing recommendations.
      </p>
    </GrowthEngineCard>
  )
}
