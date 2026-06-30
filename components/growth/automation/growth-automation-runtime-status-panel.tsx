"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, PauseCircle, PlayCircle, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthAutomationEnrollmentStatusBadge } from "@/components/growth/automation/growth-automation-enrollment-status-badge"
import { GrowthAutomationRuntimeActivationDialog } from "@/components/growth/automation/growth-automation-runtime-activation-dialog"
import { GrowthAutomationRuntimeArtifactViewer } from "@/components/growth/automation/growth-automation-runtime-artifact-viewer"
import { GrowthAutomationRuntimeHealthCard } from "@/components/growth/automation/growth-automation-runtime-health-card"
import { GrowthAutomationRuntimeMetricsGrid } from "@/components/growth/automation/growth-automation-runtime-metrics-grid"
import type { GrowthAutomationAnalyticsCounts } from "@/lib/growth/automation/growth-automation-analytics-types"
import { GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-enrollment-types"
import { GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-runtime-execution-types"
import {
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS,
  type GrowthAutomationRuntimeStatusResult,
} from "@/lib/growth/automation/growth-automation-runtime-publisher-types"
import { formatGrowthAutomationFlowStatusLabel } from "@/lib/growth/automation/growth-automation-operator-copy"
import type { GrowthAutomationRuntimeHealthSummary } from "@/lib/growth/automation/growth-automation-observability-types"

type Props = {
  flowId: string
  onChanged?: () => void
}

export function GrowthAutomationRuntimeStatusPanel({ flowId, onChanged }: Props) {
  const [status, setStatus] = useState<GrowthAutomationRuntimeStatusResult | null>(null)
  const [health, setHealth] = useState<GrowthAutomationRuntimeHealthSummary | null>(null)
  const [analyticsCounts, setAnalyticsCounts] = useState<GrowthAutomationAnalyticsCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/runtime-status`)
      const data = (await res.json()) as { status?: GrowthAutomationRuntimeStatusResult }
      if (data.status) setStatus(data.status)

      const healthRes = await fetch(`/api/platform/growth/automation/${flowId}/health`)
      const healthData = (await healthRes.json()) as { health?: GrowthAutomationRuntimeHealthSummary }
      if (healthData.health) setHealth(healthData.health)

      const summaryRes = await fetch(`/api/platform/growth/automation/${flowId}/analytics/summary`)
      const summaryData = (await summaryRes.json()) as { summary?: { counts?: GrowthAutomationAnalyticsCounts } }
      if (summaryData.summary?.counts) setAnalyticsCounts(summaryData.summary.counts)
    } finally {
      setLoading(false)
    }
  }, [flowId])

  useEffect(() => {
    void load()
  }, [load])

  const publishRuntime = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/runtime-publish`, { method: "POST" })
      const data = (await res.json()) as { ok?: boolean; publish?: { ok?: boolean } }
      if (!res.ok || !data.publish?.ok) {
        setMessage("Publish blocked — resolve validation or preview issues first.")
      } else {
        setMessage("Automation published. Approval may still be required before it runs automatically.")
      }
      await load()
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }, [flowId, load, onChanged])

  const activateRuntime = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/activate`, { method: "POST" })
      const data = (await res.json()) as { ok?: boolean; activation?: { ok?: boolean } }
      if (!res.ok || !data.activation?.ok) {
        setMessage("Activation blocked.")
      } else {
        setMessage("Automation activated. It will run automatically once approved.")
      }
      await load()
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }, [flowId, load, onChanged])

  const pauseRuntime = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/pause`, { method: "POST" })
      const data = (await res.json()) as { ok?: boolean; pause?: { ok?: boolean } }
      if (!res.ok || !data.pause?.ok) {
        setMessage("Pause failed.")
      } else {
        setMessage("Automation paused.")
      }
      await load()
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }, [flowId, load, onChanged])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading automation status…
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Automation status</h3>
          <p className="text-xs text-muted-foreground">
            Publish, activate, and pause — human approval required before automatic runs.
          </p>
        </div>
        <span className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-wide">
          {formatGrowthAutomationFlowStatusLabel(status?.effectiveFlowStatus ?? "draft")}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.runtime_publish_enabled ? (
          <span>publish enabled</span>
        ) : null}
        {GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS.enrollment_execution_enabled ? (
          <span>enrollment enabled</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.runtime_execution_enabled ? (
          <span>progression enabled</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS.message_send_execution_enabled === false ? (
          <span>no sends</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.sequence_execution_enabled === false ? (
          <span>no execution</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS.requires_human_review ? (
          <span>human review</span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Enrollment gate</span>
        <GrowthAutomationEnrollmentStatusBadge
          status={status?.metadata?.activationStatus === "active" ? "enrolled" : "blocked"}
        />
        <span className="text-muted-foreground">
          {status?.metadata?.activationStatus === "active"
            ? "Active — accepts new enrollments"
            : "Activate this automation before enrolling leads"}
        </span>
      </div>

      <div className="mt-4">
        <GrowthAutomationRuntimeHealthCard health={health} />
      </div>

      {analyticsCounts ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium">Performance snapshot</p>
          <GrowthAutomationRuntimeMetricsGrid counts={analyticsCounts} />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-border/70 p-2">
          <p className="text-muted-foreground">Activation</p>
          <p className="font-medium">{status?.metadata?.activationStatus ?? "draft"}</p>
        </div>
        <div className="rounded-md border border-border/70 p-2">
          <p className="text-muted-foreground">Pattern active</p>
          <p className="font-medium">
            {status?.patternActive == null ? "—" : status.patternActive ? "yes" : "no"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <GrowthAutomationRuntimeArtifactViewer
          patternId={status?.publishedVersion?.compiledPatternId ?? status?.metadata?.compiledPatternId ?? null}
          artifactCounts={status?.artifactCounts ?? null}
          publishHistory={status?.metadata?.publishHistory}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !status?.activationReadiness.canPublish}
          onClick={() => void publishRuntime()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          Publish automation
        </Button>
        <GrowthAutomationRuntimeActivationDialog
          readiness={status?.activationReadiness ?? null}
          loading={busy}
          onConfirm={() => void activateRuntime()}
        />
        {status?.activationReadiness.canPause ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void pauseRuntime()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <PauseCircle className="size-4" />}
            Pause
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            <PlayCircle className="size-4" />
            Execute disabled
          </Button>
        )}
      </div>

      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
