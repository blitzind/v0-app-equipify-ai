/** Server-only AI router & persistence — use from API routes, Server Actions, `server-only` libs. */

export { runAiTask } from "@/lib/ai/router"
export { recordAiUsageLog, sumUsage } from "@/lib/ai/usage"
export type { AiUsageLogInsert } from "@/lib/ai/usage"
export { getProviderAdapter, isProviderAvailable, listAvailableProvidersInPreferenceOrder } from "@/lib/ai/providers/index"
