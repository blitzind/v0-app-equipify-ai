/** GE-VERIFY-1A — Native verification freshness and refresh policy (client-safe). */

export const GROWTH_NATIVE_VERIFICATION_FRESHNESS_QA_MARKER =
  "native-verification-freshness-ge-verify-1a-v1" as const

/** Production default — matches company_contacts stale window. */
export const NATIVE_VERIFICATION_DEFAULT_TTL_DAYS = 90 as const

/** Shorter refresh when DNS signals were skipped at verification time. */
export const NATIVE_VERIFICATION_DNS_SKIPPED_TTL_DAYS = 7 as const

export type NativeVerificationFreshnessInput = {
  verified_at: string | null | undefined
  dns_skipped?: boolean
  now?: number
  ttl_days?: number
}

export function resolveNativeVerificationTtlDays(input?: {
  dns_skipped?: boolean
  env?: NodeJS.ProcessEnv
}): number {
  const envTtl = Number(input?.env?.GROWTH_NATIVE_VERIFICATION_TTL_DAYS)
  if (Number.isFinite(envTtl) && envTtl > 0) return Math.floor(envTtl)
  if (input?.dns_skipped) return NATIVE_VERIFICATION_DNS_SKIPPED_TTL_DAYS
  return NATIVE_VERIFICATION_DEFAULT_TTL_DAYS
}

export function isNativeVerificationStale(
  input: NativeVerificationFreshnessInput,
): boolean {
  if (!input.verified_at) return true
  const verifiedMs = Date.parse(input.verified_at)
  if (!Number.isFinite(verifiedMs)) return true
  const ttlDays = input.ttl_days ?? resolveNativeVerificationTtlDays({ dns_skipped: input.dns_skipped })
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000
  const now = input.now ?? Date.now()
  return now - verifiedMs >= ttlMs
}

export function shouldRefreshNativeVerification(
  input: NativeVerificationFreshnessInput,
): boolean {
  return isNativeVerificationStale(input)
}
