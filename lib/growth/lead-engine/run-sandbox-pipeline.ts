/**
 * @deprecated Use runLeadEnginePipeline from orchestrator — kept for backward compatibility.
 */
import { LEAD_ENGINE_STAGE_UI } from "@/lib/growth/lead-engine/lead-engine-stage-ui"
import { runLeadEnginePipeline } from "@/lib/growth/lead-engine/orchestrator/lead-engine-orchestrator"
import {
  GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER,
  type GrowthLeadEnginePipelineStageResult,
  type GrowthLeadEngineSandboxInput,
  type GrowthLeadEngineSandboxPipelineResult,
} from "@/lib/growth/lead-engine/workspace-types"

export const GROWTH_LEAD_ENGINE_PIPELINE_STAGES = LEAD_ENGINE_STAGE_UI.map((s) => ({
  stageId: s.stageKey,
  label: s.label,
  qaMarker: s.qaMarker,
}))

function mapStageResult(stage: ReturnType<typeof runLeadEnginePipeline>["stage_results"][number]): GrowthLeadEnginePipelineStageResult {
  return {
    stageId: stage.stage_id,
    label: stage.label,
    qaMarker: stage.qa_marker,
    status: stage.status === "completed" ? "ok" : stage.status === "failed" ? "error" : "pending",
    rawJson: stage.raw_json,
    parsed: stage.parsed,
    parseOk: stage.parse_ok,
    parseMessage: stage.parse_message,
    confidence: stage.confidence,
    evidenceSummary: stage.evidence?.summary ?? null,
    humanReviewRequired: stage.human_review_required,
  }
}

/** Fixture dry-run via orchestrator (no LLM / no outbound). */
export function runGrowthLeadEngineSandboxPipeline(
  input: GrowthLeadEngineSandboxInput,
): GrowthLeadEngineSandboxPipelineResult {
  const run = runLeadEnginePipeline(input)
  const stages = run.stage_results.map(mapStageResult)

  return {
    qaMarker: GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER,
    mode: "fixture_dry_run",
    input,
    stages,
    completedCount: run.completed_stages.length,
    errorCount: stages.filter((s) => s.status === "error").length,
  }
}
