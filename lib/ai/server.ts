/** Server-only AI router & persistence — use from API routes, Server Actions, `server-only` libs. */

export { runAiTask } from "@/lib/ai/router"
export { recordAiUsageLog, sumUsage } from "@/lib/ai/usage"
export type { AiUsageLogInsert } from "@/lib/ai/usage"
export { getProviderAdapter, isProviderAvailable, listAvailableProvidersInPreferenceOrder } from "@/lib/ai/providers/index"
export { executeOpenAiStructuredFileExtraction } from "@/lib/ai/openai-structured-file-task"
export { runOcrCleanupPlainText } from "@/lib/ai/ocr-cleanup"
export { resolveFirstOrganizationIdForUser } from "@/lib/ai/resolve-org-for-logging"
export {
  fetchOrganizationAiBudgetSettings,
  getOrganizationMtdEstimatedCostUsd,
  precheckOrganizationAiBudget,
} from "@/lib/ai/budget"
export { computeAiUsageSummary, fetchRecentAiUsageLogs } from "@/lib/ai/usage-summary"
export { fetchOrganizationAiCacheOverview, shouldLogCacheHitsToUsage } from "@/lib/ai/result-cache"
export type { AiUsageSummary, AiUsageLogRow } from "@/lib/ai/usage-summary"
export {
  evaluateAiPlanGate,
  fetchOrganizationPlanId,
  isTaskAllowedOnPlan,
  planTierDisplayName,
} from "@/lib/ai/plan-gate"
export { isPlanGatingDisabled, PLAN_AI_INCLUDED_MONTHLY_BUDGET_USD } from "@/lib/ai/plan-ai-config"
export {
  applyUserPromptTemplate,
  getPromptForTask,
  promptMetadataForLog,
} from "@/lib/ai/prompts"
export { insertQueuedAiJob } from "@/lib/ai/jobs/create-ai-job"
export {
  runPriceListImportExtractionJob,
  sanitizeAiJobError,
  failAiJob,
  completeAiJob,
  updateAiJobProgress,
} from "@/lib/ai/jobs/process-ai-job"
