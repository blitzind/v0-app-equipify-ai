/** GS-AI-PLAYBOOK-2D — Centralized prompt budget configuration (client-safe). */

import type {
  GrowthPlaybookOptimizationChannel,
  GrowthPlaybookPromptBudgetTier,
} from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimization-types"

/** Approximate character budgets — single source of truth (not token counts). */
export const GROWTH_PLAYBOOK_PROMPT_BUDGET_CHAR_LIMITS: Record<GrowthPlaybookPromptBudgetTier, number> = {
  VERY_SMALL: 1_200,
  SMALL: 2_500,
  MEDIUM: 4_500,
  LARGE: 8_000,
  VERY_LARGE: 14_000,
}

export const GROWTH_PLAYBOOK_CHANNEL_BUDGET_TIER: Record<GrowthPlaybookOptimizationChannel, GrowthPlaybookPromptBudgetTier> =
  {
    SMS: "VERY_SMALL",
    VOICE: "SMALL",
    EMAIL: "MEDIUM",
    SHARE_PAGE: "LARGE",
    REFINEMENT: "LARGE",
    COPILOT: "VERY_LARGE",
  }

export function getPromptBudgetLimitForChannel(channel: GrowthPlaybookOptimizationChannel): number {
  const tier = GROWTH_PLAYBOOK_CHANNEL_BUDGET_TIER[channel]
  return GROWTH_PLAYBOOK_PROMPT_BUDGET_CHAR_LIMITS[tier]
}

export function getPromptBudgetTierForChannel(
  channel: GrowthPlaybookOptimizationChannel,
): GrowthPlaybookPromptBudgetTier {
  return GROWTH_PLAYBOOK_CHANNEL_BUDGET_TIER[channel]
}

export function estimatePromptBudgetUtilization(size: number, limit: number): number {
  if (limit <= 0) return 1
  return Math.min(1, Math.round((size / limit) * 1000) / 1000)
}
