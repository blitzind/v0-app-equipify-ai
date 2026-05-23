import "server-only"

import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { growthAiCopilotModelSchema } from "@/lib/growth/ai-copilot-schema"
import {
  estimateGrowthAiCopilotCost,
  type GrowthAiProvider,
} from "@/lib/growth/ai-copilot-provider-types"

export type {
  GrowthAiCostEstimate,
  GrowthAiGenerateInput,
  GrowthAiGenerateResult,
  GrowthAiProvider,
  GrowthAiProviderHealth,
} from "@/lib/growth/ai-copilot-provider-types"

export { growthAiCopilotInputHash } from "@/lib/growth/ai-copilot-provider-types"

export class GrowthEngineAiProvider implements GrowthAiProvider {
  id = "growth_engine_router"

  costEstimate(input: { promptChars: number; expectedOutputTokens?: number }) {
    return estimateGrowthAiCopilotCost(input)
  }

  async health() {
    const orgId = getGrowthEngineAiOrgId()
    if (!orgId) {
      return {
        ok: false,
        provider: this.id,
        message: "GROWTH_ENGINE_AI_ORG_ID is not configured.",
      }
    }
    return { ok: true, provider: this.id }
  }

  async generate(input: import("@/lib/growth/ai-copilot-provider-types").GrowthAiGenerateInput) {
    const orgId = getGrowthEngineAiOrgId()
    if (!orgId) {
      throw new Error("AI copilot is not configured (missing GROWTH_ENGINE_AI_ORG_ID).")
    }

    const result = await runAiTask({
      task: "growth_copilot_generation",
      organizationId: orgId,
      input: {
        system: input.systemPrompt,
        user: input.userPrompt,
      },
      schema: growthAiCopilotModelSchema,
      cacheSchemaVersion: `growth_copilot_${input.generationType}_${input.promptVariant}_v1`,
      skipPlanGateCheck: true,
      skipBudgetCheck: true,
      forceLiveAi: true,
      taskOverrides: { structuredMode: "json_object" },
    })

    if (!result.ok) {
      throw new Error(result.error.message ?? "AI copilot generation failed.")
    }

    return {
      output: result.output,
      provider: result.meta.provider,
      model: result.meta.model,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        estimatedCostUsd: result.usage.estimatedCostUsd,
      },
    }
  }
}

let defaultProvider: GrowthAiProvider | null = null

export function getGrowthAiProvider(): GrowthAiProvider {
  if (!defaultProvider) {
    defaultProvider = new GrowthEngineAiProvider()
  }
  return defaultProvider
}
