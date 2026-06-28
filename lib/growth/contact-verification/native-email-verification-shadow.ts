/**
 * GE-EI-IMP-5B — native vs provider email verification shadow comparison.
 * Observability only. No runtime influence on verification outcomes.
 */

import {
  verifyEmailNatively,
  type NativeEmailVerificationResult,
} from "@/lib/growth/contact-verification/native-email-verification"
import { roundScore } from "@/lib/growth/contact-verification/confidence-signals-core"

export const GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER =
  "native-email-verification-shadow-v1" as const

export const NATIVE_EMAIL_VERIFICATION_SHADOW_TIMEOUT_MS = 1_500

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export type NativeEmailVerificationShadowInput = {
  email: string
  legacyStatus: string
  legacyConfidence?: number | null
  legacyProvider?: string | null
  context?: Record<string, unknown>
}

export type NativeEmailVerificationShadowLogEntry = {
  qa_marker: typeof GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER
  shadow: "native_email_verification"
  legacy_status: string
  native_status: string
  legacy_confidence: number | null
  native_confidence: number
  delta: number | null
  native_mx_checked: boolean
  native_mx_exists: boolean | null
  native_spf_present: boolean | null
  native_dmarc_present: boolean | null
  legacy_provider_present: boolean
  email_present: boolean
  context?: Record<string, unknown>
}

export type NativeEmailVerificationShadowDependencies = {
  verifyEmailNatively?: (
    input: Parameters<typeof verifyEmailNatively>[0],
    dependencies?: Parameters<typeof verifyEmailNatively>[1],
  ) => Promise<NativeEmailVerificationResult>
}

export function isNativeEmailVerificationShadowEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW === "true"
}

function sanitizeShadowContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!context) return undefined
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string" && PLAINTEXT_EMAIL_PATTERN.test(value)) continue
    sanitized[key] = value
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

export function buildNativeEmailVerificationShadowLogEntry(input: {
  legacyStatus: string
  legacyConfidence?: number | null
  legacyProvider?: string | null
  native: NativeEmailVerificationResult
  emailPresent: boolean
  context?: Record<string, unknown>
}): NativeEmailVerificationShadowLogEntry {
  const legacyConfidence =
    typeof input.legacyConfidence === "number" && Number.isFinite(input.legacyConfidence)
      ? roundScore(input.legacyConfidence)
      : null
  const nativeConfidence = roundScore(input.native.confidence.score)
  const delta =
    legacyConfidence === null ? null : roundScore(legacyConfidence - nativeConfidence)

  return {
    qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
    shadow: "native_email_verification",
    legacy_status: input.legacyStatus,
    native_status: input.native.status,
    legacy_confidence: legacyConfidence,
    native_confidence: nativeConfidence,
    delta,
    native_mx_checked: input.native.mx_checked,
    native_mx_exists: input.native.mx_exists,
    native_spf_present: input.native.spf_present,
    native_dmarc_present: input.native.dmarc_present,
    legacy_provider_present: Boolean(input.legacyProvider?.trim()),
    email_present: input.emailPresent,
    context: sanitizeShadowContext(input.context),
  }
}

export function logNativeEmailVerificationShadowComparison(
  entry: NativeEmailVerificationShadowLogEntry,
): void {
  console.info(JSON.stringify(entry))
}

export async function shadowCompareNativeEmailVerification(
  input: NativeEmailVerificationShadowInput,
  dependencies: NativeEmailVerificationShadowDependencies = {},
): Promise<void> {
  if (!isNativeEmailVerificationShadowEnabled()) return
  if (!input.email?.trim()) return

  try {
    const verify = dependencies.verifyEmailNatively ?? verifyEmailNatively
    const native = await verify(
      {
        email: input.email,
        timeoutMs: NATIVE_EMAIL_VERIFICATION_SHADOW_TIMEOUT_MS,
      },
      {},
    )

    logNativeEmailVerificationShadowComparison(
      buildNativeEmailVerificationShadowLogEntry({
        legacyStatus: input.legacyStatus,
        legacyConfidence: input.legacyConfidence,
        legacyProvider: input.legacyProvider,
        native,
        emailPresent: Boolean(native.normalized_email),
        context: input.context,
      }),
    )
  } catch (error) {
    console.warn(
      JSON.stringify({
        qa_marker: GROWTH_NATIVE_EMAIL_VERIFICATION_SHADOW_QA_MARKER,
        shadow: "native_email_verification_error",
        legacy_status: input.legacyStatus,
        email_present: Boolean(input.email?.trim()),
        message: error instanceof Error ? error.message : "unknown",
        context: sanitizeShadowContext(input.context),
      }),
    )
  }
}

export function assertNativeEmailVerificationShadowLogHasNoPlaintextEmails(
  output: unknown,
): boolean {
  const text = JSON.stringify(output)
  return !PLAINTEXT_EMAIL_PATTERN.test(text)
}
