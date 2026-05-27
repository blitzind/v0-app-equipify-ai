"use client"

import { useMemo } from "react"
import { ChevronRight } from "lucide-react"
import { LEAD_ENGINE_STAGE_UI } from "@/lib/growth/lead-engine/lead-engine-stage-ui"
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

  const completedCount = run?.completed_stages.length ?? 0

  return (
    <section
      className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-card p-5 shadow-sm"
      data-qa-marker="lead-intelligence-pipeline-header"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-violet-950">Lead Engine pipeline</h3>
          <p className="mt-1 text-sm text-violet-900/80">
            {run
              ? `${completedCount}/${LEAD_ENGINE_STAGE_UI.length} stages · ${run.pipeline_status}`
              : loading
                ? "Running pipeline…"
                : "Run an example account to inspect stage intelligence."}
          </p>
        </div>
        {run ? (
          <div className="rounded-lg border border-violet-200/80 bg-white/70 px-3 py-2 text-right text-xs">
            <p className="font-medium text-violet-950">{(run.pipeline_confidence * 100).toFixed(0)}% confidence</p>
            <p className="text-muted-foreground">{run.execution_duration_ms}ms</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-1">
          {LEAD_ENGINE_STAGE_UI.map((def, index) => {
            const stage = stageById.get(def.stageKey)
            const completed = stage?.status === "completed"
            const failed = stage?.status === "failed"
            const active = run?.current_stage === def.stageKey && loading

            return (
              <div key={def.stageKey} className="flex items-center gap-1">
                <div
                  className={cn(
                    "min-w-[5.5rem] rounded-lg border px-2.5 py-2 text-center text-[11px]",
                    completed && "border-emerald-300 bg-emerald-50 text-emerald-900",
                    failed && "border-destructive/40 bg-destructive/5 text-destructive",
                    active && "border-violet-400 bg-violet-100 text-violet-900 ring-2 ring-violet-200",
                    !stage && !loading && "border-border bg-background text-muted-foreground",
                    stage?.status === "skipped" && "border-border bg-muted/20 text-muted-foreground",
                  )}
                  title={def.description}
                >
                  <p className="font-semibold">{def.shortLabel}</p>
                  <p className="mt-0.5 text-[10px] opacity-80">
                    {loading && !stage ? "…" : (stage?.status ?? "pending")}
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
