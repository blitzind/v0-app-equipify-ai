"use client"

import { useMemo } from "react"
import { ChevronRight } from "lucide-react"
import { LEAD_ENGINE_STAGE_UI } from "@/lib/growth/lead-engine/lead-engine-stage-ui"
import {
  resolveLeadIntelligenceStageUxState,
  type LeadIntelligenceStageDisplayContext,
} from "@/lib/growth/lead-engine/lead-intelligence-stage-display"
import type {
  GrowthLeadEngineOrchestratorStageResult,
  GrowthLeadEnginePipelineRun,
} from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import { cn } from "@/lib/utils"

export function LeadIntelligencePipelineHeader({
  run,
  loading,
}: {
  run: GrowthLeadEnginePipelineRun | null
  loading?: boolean
}) {
  const stageById = useMemo(() => {
    const map = new Map<string, GrowthLeadEngineOrchestratorStageResult>()
    for (const s of run?.stage_results ?? []) map.set(s.stage_id, s)
    return map
  }, [run])

  const displayContext: LeadIntelligenceStageDisplayContext = {
    hasRun: Boolean(run),
    loading: Boolean(loading),
    runStatus: run?.pipeline_status ?? null,
    completedStageIds: run?.completed_stages ?? [],
    currentStageId: run?.current_stage ?? null,
    isSampleMode: run?.mode === "fixture_dry_run" || !run,
  }

  const completedCount = run?.completed_stages.length ?? 0
  const totalEvidence =
    run?.stage_results.reduce(
      (sum, s) => sum + (s.evidence?.items.length ?? 0) + s.attribution.length,
      0,
    ) ?? 0

  return (
    <section
      className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-card p-5 shadow-sm"
      data-qa-marker="lead-intelligence-pipeline-header"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-violet-950">Lead Pipeline</h3>
          <p className="mt-1 text-sm text-violet-900/80">
            {run
              ? `${completedCount}/${LEAD_ENGINE_STAGE_UI.length} stages · ${run.pipeline_status} · ${totalEvidence} evidence items`
              : loading
                ? "Running pipeline…"
                : "Run an example account to review evidence-backed stage output."}
          </p>
        </div>
        {run ? (
          <div className="rounded-lg border border-violet-200/80 bg-white/70 px-3 py-2 text-right text-xs">
            <p className="font-medium text-violet-950">{(run.pipeline_confidence * 100).toFixed(0)}% confidence</p>
            <p className="text-muted-foreground">{run.execution_duration_ms}ms total</p>
            {run.mode === "fixture_dry_run" ? (
              <p className="mt-0.5 font-medium text-amber-800">sample pipeline</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-1">
          {LEAD_ENGINE_STAGE_UI.map((def, index) => {
            const stage =
              stageById.get(def.stageKey) ??
              ({
                stage_id: def.stageKey,
                status: "pending",
                confidence: null,
                human_review_required: null,
                fatal: false,
                parse_ok: false,
                warnings: [],
                evidence: null,
                attribution: [],
                diagnostics: [],
              } as GrowthLeadEngineOrchestratorStageResult)

            const uxState = resolveLeadIntelligenceStageUxState(stage, displayContext)

            return (
              <div key={def.stageKey} className="flex items-center gap-1">
                <div
                  className={cn(
                    "min-w-[6.5rem] rounded-lg border px-2 py-2 text-center",
                    uxState === "evidence_ready" || uxState === "completed"
                      ? "border-emerald-300 bg-emerald-50"
                      : uxState === "needs_review" || uxState === "confidence_low"
                        ? "border-amber-300 bg-amber-50"
                        : uxState === "blocked"
                          ? "border-destructive/40 bg-destructive/5"
                          : uxState === "running"
                            ? "border-violet-400 bg-violet-100 ring-2 ring-violet-200"
                            : "border-border bg-background",
                  )}
                  title={def.description}
                >
                  <p className="text-[11px] font-semibold">{def.shortLabel}</p>
                  <p className="mt-0.5 text-[9px] font-medium capitalize text-muted-foreground">
                    {uxState.replace(/_/g, " ")}
                  </p>
                </div>
                {index < LEAD_ENGINE_STAGE_UI.length - 1 ? (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
