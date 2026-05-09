import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

function utcDayStartIso(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString()
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = raw?.trim() ? Number.parseInt(raw.trim(), 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Tenant-facing concept: included preview tokens per day before softer, shorter previews (still no hard block). */
export function trialPreviewWarnTokenThreshold(): number {
  return parsePositiveInt(process.env.AI_TRIAL_PREVIEW_WARN_TOKEN_DAILY, 800_000)
}

export function trialPreviewAbbreviateTokenThreshold(): number {
  return parsePositiveInt(process.env.AI_TRIAL_PREVIEW_ABBREV_TOKEN_DAILY, 2_000_000)
}

export async function sumTrialPreviewTokensToday(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const oid = organizationId.trim()
  if (!oid) return 0
  const start = utcDayStartIso()
  try {
    const { data, error } = await admin
      .from("ai_usage_logs")
      .select("prompt_tokens, completion_tokens")
      .eq("organization_id", oid)
      .gte("created_at", start)
      .eq("provider", "mock")

    if (error || !data?.length) return 0
    let sum = 0
    for (const row of data) {
      const r = row as { prompt_tokens?: number; completion_tokens?: number }
      sum += (typeof r.prompt_tokens === "number" ? r.prompt_tokens : 0) +
        (typeof r.completion_tokens === "number" ? r.completion_tokens : 0)
    }
    return sum
  } catch {
    return 0
  }
}

export type TrialPreviewCapacityHints = {
  tokensTodayApprox: number
  warnIncludedCapacity: boolean
  abbreviatedPreview: boolean
}

export async function resolveTrialPreviewCapacity(
  admin: SupabaseClient,
  organizationId: string,
): Promise<TrialPreviewCapacityHints> {
  const tokensTodayApprox = await sumTrialPreviewTokensToday(admin, organizationId)
  const warn = tokensTodayApprox >= trialPreviewWarnTokenThreshold()
  const abbreviated = tokensTodayApprox >= trialPreviewAbbreviateTokenThreshold()
  return { tokensTodayApprox, warnIncludedCapacity: warn, abbreviatedPreview: abbreviated }
}
