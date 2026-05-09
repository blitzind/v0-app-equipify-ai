import "server-only"

import { sha256Hex } from "@/lib/ai/cache-key"

/** Stable signature so mock trial responses reuse `ai_cache` without colliding with live provider rows. */
export const MOCK_TRIAL_CACHE_MODEL_SIGNATURE = sha256Hex(
  JSON.stringify({
    kind: "equipify_mock_trial_response_cache",
    version: 2,
  }),
)

export function mockTrialCacheTtlSeconds(): number {
  const raw = process.env.AI_MOCK_CACHE_TTL_SECONDS?.trim()
  const n = raw ? Number.parseInt(raw, 10) : NaN
  if (Number.isFinite(n) && n > 60) return Math.min(n, 60 * 60 * 24 * 30)
  return 60 * 60 * 24 * 7
}
