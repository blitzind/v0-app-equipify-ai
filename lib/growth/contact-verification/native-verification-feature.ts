/** GE-VERIFY-1A — Native verification feature flags (client-safe). */

export const GROWTH_NATIVE_VERIFICATION_FEATURE_QA_MARKER =
  "native-verification-feature-ge-verify-1a-v1" as const

/** When true, native engine is the authoritative verification path (replaces legacy provider chain). */
export function isNativeVerificationAuthoritative(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_NATIVE_VERIFICATION_AUTHORITATIVE?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "no") return false
  if (raw === "1" || raw === "true" || raw === "yes") return true
  return env.GROWTH_NATIVE_VERIFICATION_AUTHORITATIVE === "true"
}

/** When true, native verification performs live DNS (MX/SPF/DMARC) lookups. */
export function isNativeVerificationDnsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_NATIVE_VERIFICATION_DNS_ENABLED?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "no") return false
  if (raw === "1" || raw === "true" || raw === "yes") return true
  return env.GROWTH_NATIVE_VERIFICATION_DNS_ENABLED === "true"
}

/** Resolve skipDns for native verification calls. DNS runs when enabled unless explicitly skipped. */
export function resolveNativeVerificationSkipDns(input?: {
  skipDns?: boolean
  env?: NodeJS.ProcessEnv
}): boolean {
  if (input?.skipDns === true) return true
  if (input?.skipDns === false) return false
  return !isNativeVerificationDnsEnabled(input?.env)
}

export function isNativeVerificationConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isNativeVerificationAuthoritative(env) || isNativeVerificationDnsEnabled(env)
}
