"use client"

import { useCallback, useEffect, useState } from "react"
import { Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthAutomationRuntimeCleanupPlan } from "@/components/growth/automation/growth-automation-runtime-cleanup-plan"
import { GrowthAutomationRuntimeDiffSummary } from "@/components/growth/automation/growth-automation-runtime-diff-summary"
import { GrowthAutomationRuntimeRollbackPlan } from "@/components/growth/automation/growth-automation-runtime-rollback-plan"
import {
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-runtime-artifact-types"
import type { GrowthAutomationRuntimeReconciliationResult } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"

type Props = {
  flowId: string
  versionId?: string
  compact?: boolean
}

type PreviewResponse = {
  reconciliation?: GrowthAutomationRuntimeReconciliationResult
  artifactPreview?: GrowthAutomationRuntimeReconciliationResult["artifactPreview"]
}

export function GrowthAutomationRuntimePreviewPanel({ flowId, versionId, compact = false }: Props) {
  const [reconciliation, setReconciliation] = useState<GrowthAutomationRuntimeReconciliationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const query = versionId ? `?version_id=${encodeURIComponent(versionId)}` : ""
      const res = await fetch(`/api/platform/growth/automation/${flowId}/runtime-preview${query}`, {
        method: "POST",
      })
      const data = (await res.json()) as PreviewResponse
      if (data.reconciliation) {
        setReconciliation(data.reconciliation)
        if (data.reconciliation.status === "blocked") {
          setMessage("Preview blocked — resolve errors before publish.")
        } else if (data.reconciliation.status === "failed") {
          setMessage("Preview failed — check validation or test results.")
        }
      } else {
        setMessage("Could not load publish preview.")
      }
    } finally {
      setLoading(false)
    }
  }, [flowId, versionId])

  useEffect(() => {
    if (!compact) return
    void loadPreview()
  }, [compact, loadPreview])

  const artifact = reconciliation?.artifactPreview

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Publish preview</h3>
          <p className="text-xs text-muted-foreground">
            Compare draft changes before publishing · requires approval to go live
          </p>
        </div>
        {!compact ? (
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void loadPreview()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            Preview changes
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        {GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS.reconciliation_preview_only ? (
          <span>preview only</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS.sr3_artifact_writes_enabled === false ? (
          <span>requires approval</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS.runtime_publish_enabled === false ? (
          <span>publish paused</span>
        ) : null}
        {GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS.no_sequence_execution ? (
          <span>manual review</span>
        ) : null}
      </div>

      {loading && !reconciliation ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Building reconciliation preview…
        </div>
      ) : null}

      {reconciliation ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border/70 p-2">
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{reconciliation.status}</p>
            </div>
            <div className="rounded-md border border-border/70 p-2">
              <p className="text-muted-foreground">Plans</p>
              <p className="font-medium">
                +{reconciliation.createPlan.length} / ~{reconciliation.updatePlan.length} / −
                {reconciliation.archivePlan.length}
              </p>
            </div>
          </div>

          {artifact ? (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-4">
              <span>Steps: {artifact.steps.length}</span>
              <span>Conditions: {artifact.conditions.length}</span>
              <span>Edges: {artifact.edges.length}</span>
              <span>Waits: {artifact.waits.length}</span>
              <span>Gates: {artifact.approvalGates.length}</span>
              <span>Guards: {artifact.actionGuards.length}</span>
              <span>Triggers: {artifact.triggerBindings.length}</span>
              <span>Preview: {artifact.previewOnly ? "yes" : "no"}</span>
            </div>
          ) : null}

          <GrowthAutomationRuntimeDiffSummary diff={reconciliation.diff} />

          {reconciliation.errors.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              {reconciliation.errors.slice(0, 5).map((issue) => (
                <p key={`${issue.ruleCode}-${issue.message}`}>{issue.message}</p>
              ))}
            </div>
          ) : null}

          {reconciliation.warnings.length > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">
              {reconciliation.warnings.slice(0, 5).map((issue) => (
                <p key={`${issue.ruleCode}-${issue.message}`}>{issue.message}</p>
              ))}
            </div>
          ) : null}

          {!compact ? (
            <>
              <div>
                <p className="mb-2 text-xs font-medium">Cleanup plan</p>
                <GrowthAutomationRuntimeCleanupPlan items={reconciliation.cleanupPlan} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium">Rollback plan</p>
                <GrowthAutomationRuntimeRollbackPlan items={reconciliation.rollbackPlan} />
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
