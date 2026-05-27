/** Client-safe Growth schema health summary for Prospect Search intelligence surfaces. */

export const GROWTH_PROSPECT_SEARCH_INTELLIGENCE_SCHEMA_QA_MARKER =
  "growth-prospect-search-intelligence-schema-v1" as const

export type GrowthSchemaHealthSummary = {
  ready: boolean
  verified: boolean
  uncertain: boolean
  missing_objects: string[]
  warning_message: string | null
  env_hint: string | null
}

export function shouldShowGrowthSchemaHealthWarning(
  health: Pick<GrowthSchemaHealthSummary, "ready" | "warning_message"> | null | undefined,
): boolean {
  if (!health) return false
  if (health.ready) return false
  return Boolean(health.warning_message?.trim())
}

export function formatGrowthSchemaHealthNotice(
  health: GrowthSchemaHealthSummary | null | undefined,
): string | null {
  if (!shouldShowGrowthSchemaHealthWarning(health)) return null
  const parts = [health!.warning_message!.trim()]
  if (health!.env_hint?.trim()) parts.push(health!.env_hint!.trim())
  return parts.join(" ")
}

export type GrowthSchemaProbeOutcome = "detected" | "missing" | "uncertain"

export type GrowthSchemaObjectProbe = {
  table: string
  columns: string[]
  label: string
}

function resolveSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!url) return null
  try {
    return new URL(url).hostname.split(".")[0] ?? null
  } catch {
    return null
  }
}

function buildGrowthSchemaEnvHint(): string | null {
  const ref = resolveSupabaseProjectRef()
  if (!ref) {
    return "Supabase URL is not configured — verify NEXT_PUBLIC_SUPABASE_URL matches the project where migrations were applied."
  }
  return `Connected to Supabase project "${ref}". If migrations were applied elsewhere, update env to match that project.`
}

function buildGrowthSchemaWarningMessage(input: {
  featureLabel: string
  missingObjects: string[]
}): string | null {
  if (input.missingObjects.length === 0) return null
  const objects = input.missingObjects.join(", ")
  return `${input.featureLabel} schema is incomplete — missing ${objects}. Apply pending Growth Engine migrations to this Supabase project, then reload the API schema cache.`
}

/** Pure probe aggregation — safe to import from tests and client components. */
export function summarizeGrowthSchemaProbeResults(input: {
  featureLabel: string
  objects: GrowthSchemaObjectProbe[]
  outcomes: GrowthSchemaProbeOutcome[]
}): GrowthSchemaHealthSummary {
  const missing_objects: string[] = []
  let uncertain = false

  for (let i = 0; i < input.objects.length; i += 1) {
    const outcome = input.outcomes[i] ?? "uncertain"
    if (outcome === "missing") missing_objects.push(input.objects[i]!.label)
    if (outcome === "uncertain") uncertain = true
  }

  const verified = missing_objects.length === 0 && !uncertain
  const ready = missing_objects.length === 0

  return {
    ready,
    verified,
    uncertain: uncertain && missing_objects.length === 0,
    missing_objects,
    warning_message: buildGrowthSchemaWarningMessage({
      featureLabel: input.featureLabel,
      missingObjects: missing_objects,
    }),
    env_hint: missing_objects.length > 0 ? buildGrowthSchemaEnvHint() : null,
  }
}

export function mergeGrowthSchemaHealthSummaries(
  summaries: GrowthSchemaHealthSummary[],
): GrowthSchemaHealthSummary {
  const missing_objects = [...new Set(summaries.flatMap((row) => row.missing_objects))]
  const uncertain = summaries.some((row) => row.uncertain) && missing_objects.length === 0
  const ready = summaries.every((row) => row.ready)
  const verified = summaries.every((row) => row.verified)
  const warning_message =
    summaries.map((row) => row.warning_message).find((message) => Boolean(message?.trim())) ?? null
  const env_hint = summaries.map((row) => row.env_hint).find((hint) => Boolean(hint?.trim())) ?? null

  return {
    ready,
    verified,
    uncertain,
    missing_objects,
    warning_message,
    env_hint,
  }
}
