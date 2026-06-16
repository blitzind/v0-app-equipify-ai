"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Rocket, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthAutomationRuntimeArtifactViewer } from "@/components/growth/automation/growth-automation-runtime-artifact-viewer"
import { GrowthAutomationRuntimeCleanupPlan } from "@/components/growth/automation/growth-automation-runtime-cleanup-plan"
import { GrowthAutomationRuntimeDiffSummary } from "@/components/growth/automation/growth-automation-runtime-diff-summary"
import { GrowthAutomationRuntimeRollbackPlan } from "@/components/growth/automation/growth-automation-runtime-rollback-plan"
import { GrowthAutomationPublishDialog } from "@/components/growth/automation/growth-automation-publish-dialog"
import { GrowthAutomationPublishStatusBadge } from "@/components/growth/automation/growth-automation-publish-status-badge"
import { GrowthAutomationVersionTimeline } from "@/components/growth/automation/growth-automation-version-timeline"
import {
  GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS,
  type GrowthAutomationPublishReadinessResult,
  type GrowthAutomationPublishStatusResult,
} from "@/lib/growth/automation/growth-automation-publish-types"
import { GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-runtime-artifact-types"
import type { GrowthAutomationRuntimeReconciliationResult } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"

type Props = {
  flowId: string
  versionId?: string
  onPublished?: () => void
}

export function GrowthAutomationPublishPanel({ flowId, versionId, onPublished }: Props) {
  const [status, setStatus] = useState<GrowthAutomationPublishStatusResult | null>(null)
  const [readiness, setReadiness] = useState<GrowthAutomationPublishReadinessResult | null>(null)
  const [reconciliation, setReconciliation] = useState<GrowthAutomationRuntimeReconciliationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const query = versionId ? `?version_id=${encodeURIComponent(versionId)}` : ""
      const [statusRes, reconciliationRes] = await Promise.all([
        fetch(`/api/platform/growth/automation/${flowId}/publish-status`),
        fetch(`/api/platform/growth/automation/${flowId}/reconciliation${query}`),
      ])
      const data = (await statusRes.json()) as { status?: GrowthAutomationPublishStatusResult }
      const reconciliationData = (await reconciliationRes.json()) as {
        reconciliation?: GrowthAutomationRuntimeReconciliationResult
      }
      if (data.status) {
        setStatus(data.status)
        setReadiness({
          ok: data.status.publishReadiness === "ready",
          publishReadiness: data.status.publishReadiness,
          publishStatus: data.status.publishStatus,
          requiresHumanReview: data.status.requiresHumanReview,
          validationOk: data.status.publishErrors.every((issue) => issue.ruleCode !== "validation_blocked"),
          compileOk: data.status.publishErrors.every((issue) => issue.ruleCode !== "compiler_blocked"),
          simulationOk: data.status.publishErrors.every((issue) => issue.ruleCode !== "simulation_blocked"),
          publishWarnings: data.status.publishWarnings,
          publishErrors: data.status.publishErrors,
          compileSummary: data.status.compileSummary,
          compileId: data.status.metadata?.compileId ?? null,
          simulationId: data.status.metadata?.simulationId ?? null,
          simulationStatus: data.status.metadata?.simulationStatus ?? null,
          lastCompiledAt: data.status.lastCompiledAt,
          lastSimulatedAt: data.status.metadata?.lastSimulatedAt ?? null,
        })
      }
      if (reconciliationData.reconciliation) {
        setReconciliation(reconciliationData.reconciliation)
      }
    } finally {
      setLoading(false)
    }
  }, [flowId, versionId])

  useEffect(() => {
    void load()
  }, [load])

  const publish = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/publish`, { method: "POST" })
      const data = (await res.json()) as { ok?: boolean; publish?: { ok?: boolean } }
      if (!res.ok || !data.publish?.ok) {
        setMessage("Publish blocked — resolve validation, compile, or simulation errors.")
        await load()
        return
      }
      setMessage("Version published (metadata only). New draft created.")
      await load()
      onPublished?.()
    } finally {
      setBusy(false)
    }
  }, [flowId, load, onPublished])

  const unpublish = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/unpublish`, { method: "POST" })
      if (!res.ok) {
        setMessage("Unpublish failed.")
        return
      }
      setMessage("Flow moved back to draft. Published version history preserved.")
      await load()
    } finally {
      setBusy(false)
    }
  }, [flowId, load])

  const createDraft = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/automation/${flowId}/draft-from-published`, {
        method: "POST",
      })
      if (!res.ok) {
        setMessage("Could not create draft from published version.")
        return
      }
      setMessage("Draft version created from published snapshot.")
      await load()
      onPublished?.()
    } finally {
      setBusy(false)
    }
  }, [flowId, load, onPublished])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading publish status…
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Publish gate</h3>
          <p className="text-xs text-muted-foreground">
            Metadata-only publish · runtime reconciliation preview (S5-G)
          </p>
        </div>
        <GrowthAutomationPublishStatusBadge
          status={status?.publishStatus ?? "draft"}
          readiness={status?.publishReadiness}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS.publish_metadata_only ? <span>metadata only</span> : null}
        {GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS.sr3_artifact_writes_enabled === false ? (
          <span>no SR-3 writes</span>
        ) : null}
        {GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS.runtime_publish_enabled === false ? (
          <span>runtime disabled</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS.reconciliation_preview_only ? (
          <span>reconciliation preview</span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-border/70 p-2">
          <p className="text-muted-foreground">Current version</p>
          <p className="font-medium">v{status?.currentVersion?.versionNumber ?? "—"}</p>
        </div>
        <div className="rounded-md border border-border/70 p-2">
          <p className="text-muted-foreground">Published version</p>
          <p className="font-medium">v{status?.publishedVersion?.versionNumber ?? "—"}</p>
        </div>
      </div>

      {status?.publishErrors.length ? (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {status.publishErrors.slice(0, 5).map((issue) => (
            <p key={`${issue.ruleCode}-${issue.message}`}>{issue.message}</p>
          ))}
        </div>
      ) : null}

      {status?.publishWarnings.length ? (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
          {status.publishWarnings.slice(0, 5).map((issue) => (
            <p key={`${issue.ruleCode}-${issue.message}`}>{issue.message}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <GrowthAutomationPublishDialog readiness={readiness} loading={busy} onConfirm={() => void publish()} />
        {status?.publishStatus === "published" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void unpublish()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
            Unpublish
          </Button>
        ) : null}
        {status?.publishedVersion ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void createDraft()}>
            <Rocket className="size-4" />
            Draft from published
          </Button>
        ) : null}
      </div>

      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}

      {reconciliation ? (
        <div className="mt-4 space-y-3 rounded-md border border-border/70 p-3">
          <p className="text-xs font-medium">Runtime reconciliation</p>
          <GrowthAutomationRuntimeDiffSummary diff={reconciliation.diff} />
          <GrowthAutomationRuntimeCleanupPlan items={reconciliation.cleanupPlan} />
          <GrowthAutomationRuntimeRollbackPlan items={reconciliation.rollbackPlan} />
          <GrowthAutomationRuntimeArtifactViewer
            patternId={status?.publishedVersion?.compiledPatternId ?? null}
            artifactCounts={null}
          />
        </div>
      ) : null}

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium">Version timeline</p>
        <GrowthAutomationVersionTimeline
          versions={status?.versions ?? []}
          currentVersionId={status?.flow.currentVersionId}
          publishedVersionId={status?.flow.publishedVersionId}
        />
      </div>
    </div>
  )
}
