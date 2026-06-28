/** Core types + shadow compare/log helpers (no builder dependencies). Client-safe. */

export const GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER =
  "growth-email-confidence-signals-v1" as const

export const RECIPIENT_EMAIL_CONFIDENCE_SIGNAL_SOURCES = [
  "zerobounce",
  "email_discovery",
  "apollo",
  "verification_depth",
  "contact_evidence",
  "lead_engine",
  "learning_placeholder",
  "native_syntax",
  "native_domain",
  "native_disposable",
  "native_role",
  "native_discovery_context",
  "native_verification_depth",
  "provider_verification",
] as const

export type RecipientEmailConfidenceSignalSource =
  (typeof RECIPIENT_EMAIL_CONFIDENCE_SIGNAL_SOURCES)[number]

export const RECIPIENT_EMAIL_CONFIDENCE_SIGNAL_STRENGTHS = [
  "authoritative",
  "strong",
  "moderate",
  "weak",
  "negative",
  "blocking",
  "informational",
] as const

export type RecipientEmailConfidenceSignalStrength =
  (typeof RECIPIENT_EMAIL_CONFIDENCE_SIGNAL_STRENGTHS)[number]

export type RecipientEmailConfidenceSignal = {
  source: RecipientEmailConfidenceSignalSource
  score: number
  strength: RecipientEmailConfidenceSignalStrength
  status: string
  reason: string
  metadata: Record<string, unknown>
}

export type RecipientEmailConfidenceSignalBundle = {
  qa_marker: typeof GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER
  normalized_email: string | null
  signals: RecipientEmailConfidenceSignal[]
}

export type RecipientEmailConfidenceSignalComparison = {
  matched: boolean
  diffs: Array<{
    source: RecipientEmailConfidenceSignalSource
    left_score: number | null
    right_score: number | null
    delta: number | null
  }>
}

export type RecipientEmailConfidenceShadowContext = {
  integration: string
  source?: RecipientEmailConfidenceSignalSource | string
  legacy_score?: number | null
  signal_score?: number | null
  delta?: number | null
  status?: string | null
  [key: string]: unknown
}

export function roundScore(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(3))
}

export function compareRecipientEmailConfidenceSignals(
  left: RecipientEmailConfidenceSignal[],
  right: RecipientEmailConfidenceSignal[],
  options?: { tolerance?: number },
): RecipientEmailConfidenceSignalComparison {
  const tolerance = options?.tolerance ?? 0.0005
  const sources = new Set<RecipientEmailConfidenceSignalSource>([
    ...left.map((signal) => signal.source),
    ...right.map((signal) => signal.source),
  ])

  const diffs: RecipientEmailConfidenceSignalComparison["diffs"] = []
  let matched = true

  for (const source of sources) {
    const leftSignal = left.find((signal) => signal.source === source)
    const rightSignal = right.find((signal) => signal.source === source)
    const leftScore = leftSignal?.score ?? null
    const rightScore = rightSignal?.score ?? null

    if (leftScore == null || rightScore == null) {
      matched = false
      diffs.push({ source, left_score: leftScore, right_score: rightScore, delta: null })
      continue
    }

    const delta = roundScore(leftScore - rightScore)
    if (Math.abs(delta) > tolerance) {
      matched = false
    }
    diffs.push({ source, left_score: leftScore, right_score: rightScore, delta })
  }

  return { matched, diffs }
}

export function isEmailConfidenceShadowLoggingEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS === "true"
}

/** Dev-only shadow logger — no output unless GROWTH_EMAIL_CONFIDENCE_SHADOW_LOGS=true. */
export function logRecipientEmailConfidenceShadowComparison(input: {
  label: string
  comparison: RecipientEmailConfidenceSignalComparison
  bundle?: RecipientEmailConfidenceSignalBundle
  context?: RecipientEmailConfidenceShadowContext
}): void {
  if (!isEmailConfidenceShadowLoggingEnabled()) return
  console.info(
    JSON.stringify({
      qa_marker: GROWTH_EMAIL_CONFIDENCE_SIGNALS_QA_MARKER,
      shadow: "recipient_email_confidence",
      label: input.label,
      matched: input.comparison.matched,
      diffs: input.comparison.diffs,
      signal_count: input.bundle?.signals.length ?? null,
      context: input.context ?? null,
    }),
  )
}
