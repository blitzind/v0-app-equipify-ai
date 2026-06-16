"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Radar } from "lucide-react"
import { GrowthAutomationRuntimeActivityFeed } from "@/components/growth/automation/growth-automation-runtime-activity-feed"
import { GrowthAutomationRuntimeCountsGrid } from "@/components/growth/automation/growth-automation-runtime-counts-grid"
import { GrowthAutomationRuntimeHealthCard } from "@/components/growth/automation/growth-automation-runtime-health-card"
import { GrowthAutomationRuntimeManagementControls } from "@/components/growth/automation/growth-automation-runtime-management-controls"
import { GrowthAutomationStuckWaitsPanel } from "@/components/growth/automation/growth-automation-stuck-waits-panel"
import {
  GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
  GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS,
  type GrowthAutomationRuntimeObservabilitySnapshot,
} from "@/lib/growth/automation/growth-automation-observability-types"

type Props = {
  flowId: string
  enrollmentId?: string | null
  leadId?: string | null
  onChanged?: () => void
}

type ObservabilityResponse = {
  observability?: GrowthAutomationRuntimeObservabilitySnapshot
}

export function GrowthAutomationObservabilityPanel({
  flowId,
  enrollmentId,
  leadId,
  onChanged,
}: Props) {
  const [snapshot, setSnapshot] = useState<GrowthAutomationRuntimeObservabilitySnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/observability`)
      const data = (await res.json()) as ObservabilityResponse
      if (data.observability) setSnapshot(data.observability)
    } finally {
      setLoading(false)
    }
  }, [flowId])

  useEffect(() => {
    void load()
  }, [load])

  const handleChanged = () => {
    void load()
    onChanged?.()
  }

  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
      data-qa-marker={GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Radar className="size-4" />
            Runtime observability
          </h3>
          <p className="text-xs text-muted-foreground">
            Read-only visibility · safe management controls · no sends
          </p>
        </div>
        <span className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide">
          {snapshot?.runtimeStatus ?? "unknown"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.observability_enabled ? (
          <span>observability</span>
        ) : null}
        {GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.requires_human_review ? (
          <span>human review</span>
        ) : null}
        {GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS.autonomous_execution_enabled === false ? (
          <span>no autonomous execution</span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading observability…
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <GrowthAutomationRuntimeHealthCard health={snapshot?.health ?? null} />
          <GrowthAutomationRuntimeCountsGrid counts={snapshot?.counts ?? null} />
          <div>
            <p className="mb-2 text-xs font-medium">Recent activity</p>
            <GrowthAutomationRuntimeActivityFeed activity={snapshot?.recentActivity ?? []} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Stuck waits</p>
            <GrowthAutomationStuckWaitsPanel stuckWaits={snapshot?.stuckWaits ?? []} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium">Management controls</p>
            <GrowthAutomationRuntimeManagementControls
              flowId={flowId}
              enrollmentId={enrollmentId}
              leadId={leadId}
              killSwitch={snapshot?.killSwitch ?? null}
              onChanged={handleChanged}
            />
          </div>
        </div>
      )}
    </div>
  )
}
