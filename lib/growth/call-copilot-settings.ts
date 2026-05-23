/** Client-safe Call Copilot settings helpers and user-facing messages. */

import type { GrowthCopilotSettings } from "@/lib/growth/ai-copilot-types"

export const GROWTH_CALL_COPILOT_DISABLED_CODE = "call_copilot_disabled" as const

export const GROWTH_CALL_COPILOT_DISABLED_MESSAGE =
  "Call Copilot is disabled in Growth Settings. Enable it under Admin → Growth → Settings."

export const GROWTH_CALL_COPILOT_DISABLED_DRAWER_MESSAGE =
  "Call Copilot is disabled in Growth Settings."

export function resolveGrowthCallCopilotEnabled(
  settings: Pick<GrowthCopilotSettings, "callCopilotEnabled" | "aiCopilotEnabled">,
): boolean {
  if (typeof settings.callCopilotEnabled === "boolean") return settings.callCopilotEnabled
  return settings.aiCopilotEnabled ?? true
}

export function resolveGrowthCallCopilotRequireSummaryApproval(
  settings: Pick<GrowthCopilotSettings, "callCopilotRequireSummaryApproval">,
): boolean {
  return settings.callCopilotRequireSummaryApproval ?? true
}

export function isGrowthCallCopilotDisabledError(code: string | undefined | null): boolean {
  return code === GROWTH_CALL_COPILOT_DISABLED_CODE
}
