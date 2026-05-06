/** Rough USD per 1M tokens — tune periodically; used for estimates only (not invoicing). */

export type ModelPriceKey = string

type PricePerMillion = { input: number; output: number }

/** Normalize keys: lowercase, strip vendor prefix. */
function norm(model: string): string {
  return model.trim().toLowerCase().replace(/^openai\//, "").replace(/^anthropic\//, "")
}

const TABLE: Record<string, PricePerMillion> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4-turbo-preview": { input: 10, output: 30 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash-8b": { input: 0.0375, output: 0.15 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },
}

const DEFAULT: PricePerMillion = { input: 1, output: 4 }

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const key = norm(model)
  const row = TABLE[key] ?? DEFAULT
  const inCost = (promptTokens / 1_000_000) * row.input
  const outCost = (completionTokens / 1_000_000) * row.output
  return Math.round((inCost + outCost) * 1_000_000) / 1_000_000
}
