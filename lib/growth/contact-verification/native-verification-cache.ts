/** GE-VERIFY-1A — In-process native verification result cache with TTL. Server-only. */

import "server-only"

import type { NativeEmailVerificationResult } from "@/lib/growth/contact-verification/native-email-verification"
import {
  isNativeVerificationStale,
  resolveNativeVerificationTtlDays,
} from "@/lib/growth/contact-verification/native-verification-freshness"

type CacheEntry = {
  result: NativeEmailVerificationResult
  verified_at: string
  dns_skipped: boolean
}

const cache = new Map<string, CacheEntry>()

export function getCachedNativeVerification(email: string): NativeEmailVerificationResult | null {
  const key = email.trim().toLowerCase()
  const entry = cache.get(key)
  if (!entry) return null
  if (
    isNativeVerificationStale({
      verified_at: entry.verified_at,
      dns_skipped: entry.dns_skipped,
    })
  ) {
    cache.delete(key)
    return null
  }
  return entry.result
}

export function setCachedNativeVerification(
  email: string,
  result: NativeEmailVerificationResult,
): void {
  const key = email.trim().toLowerCase()
  const dns_skipped = result.warnings.includes("dns_skipped")
  cache.set(key, {
    result,
    verified_at: new Date().toISOString(),
    dns_skipped,
  })
}

export function clearNativeVerificationCache(): void {
  cache.clear()
}

export function getNativeVerificationCacheStats(): {
  size: number
  ttl_days_default: number
  ttl_days_dns_skipped: number
} {
  return {
    size: cache.size,
    ttl_days_default: resolveNativeVerificationTtlDays(),
    ttl_days_dns_skipped: resolveNativeVerificationTtlDays({ dns_skipped: true }),
  }
}
