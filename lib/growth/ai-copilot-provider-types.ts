import { createHash } from "node:crypto"
import type {
  GrowthAiCopilotPromptVariant,
  GrowthAiCopilotGenerationType,
} from "@/lib/growth/ai-copilot-types"

export type GrowthAiProviderHealth = {
  ok: boolean
  provider: string
  message?: string
}

export type GrowthAiCostEstimate = {
  estimatedCostUsd: number
  promptTokensEstimate: number
  completionTokensEstimate: number
}

export type GrowthAiGenerateInput = {
  generationType: GrowthAiCopilotGenerationType
  promptVariant: GrowthAiCopilotPromptVariant | string
  systemPrompt: string
  userPrompt: string
  actingUserId: string
}

export type GrowthAiGenerateResult = {
  output: unknown
  provider: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    estimatedCostUsd: number
  }
}

export interface GrowthAiProvider {
  id: string
  generate(input: GrowthAiGenerateInput): Promise<GrowthAiGenerateResult>
  health(): Promise<GrowthAiProviderHealth>
  costEstimate(input: { promptChars: number; expectedOutputTokens?: number }): GrowthAiCostEstimate
}

export function growthAiCopilotInputHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32)
}

export function estimateGrowthAiCopilotCost(input: {
  promptChars: number
  expectedOutputTokens?: number
}): GrowthAiCostEstimate {
  const promptTokensEstimate = Math.max(1, Math.ceil(input.promptChars / 4))
  const completionTokensEstimate = input.expectedOutputTokens ?? 800
  const estimatedCostUsd = Number(
    (promptTokensEstimate * 0.00000015 + completionTokensEstimate * 0.0000006).toFixed(6),
  )
  return { estimatedCostUsd, promptTokensEstimate, completionTokensEstimate }
}
