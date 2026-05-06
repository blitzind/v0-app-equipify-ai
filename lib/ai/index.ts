/** Client-safe exports (types, registry, helpers). Import `runAiTask` from `@/lib/ai/server`. */

export type {
  AiChatMessage,
  AiContentPart,
  AiCostTier,
  AiModelRef,
  AiModelTier,
  AiProviderId,
  AiRunMeta,
  AiTaskDefinition,
  AiTaskFailure,
  AiTaskId,
  AiTaskInput,
  AiTaskResult,
  AiTaskSuccess,
  AiUsageTotals,
  EscalationReason,
  RunAiTaskOptions,
} from "@/lib/ai/types"

export { AI_TASK_REGISTRY, getTaskDefinition } from "@/lib/ai/tasks"
export { estimateCostUsd } from "@/lib/ai/pricing"
export {
  extractFirstJsonObject,
  extractMinConfidence,
  parseJsonSafe,
  parseWithSchema,
  parseWithSchemaSafe,
} from "@/lib/ai/structured"
export { applyPrimaryModelRef, getAiEnvConfig, isProviderEnabled } from "@/lib/ai/config"
