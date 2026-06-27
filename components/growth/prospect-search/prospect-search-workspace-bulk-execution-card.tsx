"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  executeProspectSearchWorkspaceBulkResearch,
  validateProspectSearchWorkspaceBulkExecution,
} from "@/lib/growth/prospect-search/prospect-search-workspace-bulk-execution"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import type {
  ProspectSearchWorkspaceBulkExecutionResult,
  ProspectSearchWorkspaceExecutionPreview,
  ProspectSearchWorkspaceQueueId,
  ProspectSearchWorkspaceWorklistMetrics,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_UX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_BULK_CANCEL_LABEL,
  PROSPECT_SEARCH_WORKSPACE_BULK_CONFIRM_LABEL,
  PROSPECT_SEARCH_WORKSPACE_BULK_EXECUTION_TITLE,
  PROSPECT_SEARCH_WORKSPACE_BULK_QUEUE_RESEARCH_LABEL,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

type ConfirmationPhase = "idle" | "confirming" | "executing" | "done"

export function ProspectSearchWorkspaceBulkExecutionCard({
  companies,
  selectedCompanyKeys,
  selectedQueueId,
  preview,
  metrics,
  onExecutionComplete,
  className,
}: {
  companies: GrowthProspectSearchCompanyResult[]
  selectedCompanyKeys: string[]
  selectedQueueId: ProspectSearchWorkspaceQueueId | null
  preview: ProspectSearchWorkspaceExecutionPreview | null
  metrics: ProspectSearchWorkspaceWorklistMetrics
  onExecutionComplete?: (result: ProspectSearchWorkspaceBulkExecutionResult) => void
  className?: string
}) {
  const [phase, setPhase] = useState<ConfirmationPhase>("idle")
  const [result, setResult] = useState<ProspectSearchWorkspaceBulkExecutionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const validation = useMemo(
    () =>
      validateProspectSearchWorkspaceBulkExecution({
        selected_company_keys: selectedCompanyKeys,
        preview,
        queue_id: selectedQueueId,
        companies,
      }),
    [selectedCompanyKeys, preview, selectedQueueId, companies],
  )

  useEffect(() => {
    setPhase("idle")
    setResult(null)
    setErrorMessage(null)
  }, [selectedCompanyKeys, selectedQueueId, preview])

  async function runBulkEnqueue() {
    if (!preview || !selectedQueueId) return
    setPhase("executing")
    setErrorMessage(null)
    try {
      const execution = await executeProspectSearchWorkspaceBulkResearch({
        companies,
        company_keys: selectedCompanyKeys,
        queue_id: selectedQueueId,
        preview,
      })
      setResult(execution)
      setPhase("done")
      onExecutionComplete?.(execution)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Bulk enqueue failed.")
      setPhase("idle")
    }
  }

  const disabledReason = validation.reason
  const canStart = validation.allowed && phase === "idle"
  const confirming = phase === "confirming"

  return (
    <section
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER}
      data-workspace-ux-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_UX_QA_MARKER}
      data-workspace-bulk-execution="v1"
    >
      <h4 className="text-sm font-semibold text-slate-950">
        {PROSPECT_SEARCH_WORKSPACE_BULK_EXECUTION_TITLE}
      </h4>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Operator-approved bulk enqueue via existing AI OS job APIs. Preview-eligible
        accounts only; blocked accounts are skipped.
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {!confirming ? (
          <Button
            type="button"
            size="sm"
            disabled={!canStart || phase === "executing"}
            title={disabledReason ?? undefined}
            onClick={() => setPhase("confirming")}
          >
            {PROSPECT_SEARCH_WORKSPACE_BULK_QUEUE_RESEARCH_LABEL}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={phase === "executing"}
              onClick={() => void runBulkEnqueue()}
            >
              {phase === "executing" ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : null}
              {PROSPECT_SEARCH_WORKSPACE_BULK_CONFIRM_LABEL}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={phase === "executing"}
              onClick={() => setPhase("idle")}
            >
              {PROSPECT_SEARCH_WORKSPACE_BULK_CANCEL_LABEL}
            </Button>
          </>
        )}
      </div>

      {confirming ? (
        <p className="mt-2 text-xs text-slate-800">
          Confirm bulk enqueue for {metrics.selected_accounts} selected account(s) —{" "}
          {validation.executable_count} eligible, {metrics.blocked_accounts} blocked in preview.
          Jobs are queued asynchronously; refresh results when workers complete.
        </p>
      ) : null}

      {disabledReason && phase === "idle" ? (
        <p className="mt-2 text-[11px] text-amber-800">{disabledReason}</p>
      ) : null}

      {errorMessage ? (
        <p className="mt-2 text-[11px] text-destructive">{errorMessage}</p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white/90 p-3 text-xs">
          <p className="font-medium text-slate-950">Bulk enqueue summary</p>
          <p className="text-muted-foreground">
            Requested {result.requested_count} · Enqueued {result.enqueued_count} · Already satisfied{" "}
            {result.already_satisfied_count} · Skipped {result.skipped_count} · Failed{" "}
            {result.failed_count}
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {result.per_account_results.map((row) => (
              <li key={row.company_key} className="rounded border border-slate-100 px-2 py-1">
                <span className="font-medium">{row.company_name}</span>
                <span className="text-muted-foreground"> — {row.status.replace(/_/g, " ")}</span>
                <p className="text-[10px] text-slate-700">{row.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
