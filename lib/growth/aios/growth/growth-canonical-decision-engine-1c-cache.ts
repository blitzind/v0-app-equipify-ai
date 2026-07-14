/**
 * GE-AIOS-DECISION-ENGINE-1C — Bounded per-job canonical decision resolution cache (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import { isLeadLifecycleBlockedByDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { resolveGrowthCanonicalDecisionForLead } from "@/lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead"

type CacheEntry = {
  resolution: GrowthCanonicalDecisionResolution
  expiresAt: number
}

const CACHE_TTL_MS = 30_000
const MAX_CACHE_ENTRIES = 256

const decisionResolutionCache = new Map<string, CacheEntry>()

function buildCacheKey(input: {
  organizationId: string
  leadId: string
  materialEventVersion?: string | null
  packageVersion?: string | null
  scope?: string | null
  lifecycleVersion?: string | null
  postCallClosureFingerprint?: string | null
}): string {
  return [
    input.organizationId,
    input.leadId,
    input.materialEventVersion ?? "none",
    input.packageVersion ?? "none",
    input.lifecycleVersion ?? "none",
    input.postCallClosureFingerprint ?? "none",
    input.scope ?? "runtime",
  ].join(":")
}

export function invalidateCanonicalDecisionCacheForLead(
  leadId: string,
  _reason?: string,
): void {
  for (const key of [...decisionResolutionCache.keys()]) {
    if (key.split(":")[1] === leadId) {
      decisionResolutionCache.delete(key)
    }
  }
}

export function invalidateCanonicalDecisionCacheEntry(input: {
  organizationId: string
  leadId: string
  materialEventVersion?: string | null
  packageVersion?: string | null
  lifecycleVersion?: string | null
  postCallClosureFingerprint?: string | null
  scope?: string | null
}): void {
  const cacheKey = buildCacheKey(input)
  decisionResolutionCache.delete(cacheKey)
}

function pruneCache(): void {
  if (decisionResolutionCache.size <= MAX_CACHE_ENTRIES) return
  const now = Date.now()
  for (const [key, entry] of decisionResolutionCache) {
    if (entry.expiresAt <= now) decisionResolutionCache.delete(key)
    if (decisionResolutionCache.size <= MAX_CACHE_ENTRIES) break
  }
  if (decisionResolutionCache.size > MAX_CACHE_ENTRIES) {
    const oldest = [...decisionResolutionCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    for (const [key] of oldest.slice(0, decisionResolutionCache.size - MAX_CACHE_ENTRIES)) {
      decisionResolutionCache.delete(key)
    }
  }
}

export function clearCanonicalDecisionResolutionCache(): void {
  decisionResolutionCache.clear()
}

export function buildCanonicalDecisionCacheVersions(
  resolution: GrowthCanonicalDecisionResolution,
): {
  lifecycleVersion: string
  postCallClosureFingerprint: string | null
  materialEventVersion: string | null
  packageVersion: string | null
} {
  const { decision, suppressionHints, freshness } = resolution
  return {
    lifecycleVersion: [
      decision.primaryAction,
      decision.waitUntil ?? "none",
      decision.operatorReviewRequired,
      suppressionHints.suppressTransport,
      suppressionHints.suppressColdOutreach,
      suppressionHints.suppressDuplicatePackage,
      isLeadLifecycleBlockedByDecision(decision),
      freshness.state,
    ].join("|"),
    postCallClosureFingerprint: decision.sourceSummary.latestMaterialEvent ?? null,
    materialEventVersion: decision.sourceSummary.latestMaterialEvent ?? null,
    packageVersion: freshness.packageFingerprint,
  }
}

export async function resolveGrowthCanonicalDecisionForLeadCached(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generatedAt?: string
    materialEvent?: string | null
    packageSnapshot?: import("@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types").GrowthAutonomousOutreachApprovalPackage | null
    cacheScope?: string | null
    bypassCache?: boolean
    lifecycleVersion?: string | null
    postCallClosureFingerprint?: string | null
    preloadedMemoryBundle?: import("@/lib/growth/lead-memory/canonical-human-memory-types").CanonicalHumanMemoryBundle | null
  },
): Promise<GrowthCanonicalDecisionResolution> {
  const materialEventVersion =
    input.materialEvent ?? input.packageSnapshot?.packageId ?? null
  const packageVersion = input.packageSnapshot?.packageId ?? null
  const cacheKey = buildCacheKey({
    organizationId: input.organizationId,
    leadId: input.leadId,
    materialEventVersion,
    packageVersion,
    lifecycleVersion: input.lifecycleVersion ?? null,
    postCallClosureFingerprint: input.postCallClosureFingerprint ?? null,
    scope: input.cacheScope,
  })

  if (!input.bypassCache) {
    const cached = decisionResolutionCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.resolution
    }
  }

  const resolution = await resolveGrowthCanonicalDecisionForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    materialEvent: input.materialEvent ?? undefined,
    packageSnapshot: input.packageSnapshot ?? undefined,
    preloadedMemoryBundle: input.preloadedMemoryBundle ?? undefined,
  })

  if (!resolution) {
    throw new Error("Canonical decision resolution failed.")
  }

  const versions = buildCanonicalDecisionCacheVersions(resolution)
  const resolvedCacheKey = buildCacheKey({
    organizationId: input.organizationId,
    leadId: input.leadId,
    materialEventVersion: versions.materialEventVersion,
    packageVersion: versions.packageVersion ?? input.packageSnapshot?.packageId ?? null,
    lifecycleVersion: versions.lifecycleVersion,
    postCallClosureFingerprint: versions.postCallClosureFingerprint,
    scope: input.cacheScope,
  })

  const entry: CacheEntry = {
    resolution,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }

  decisionResolutionCache.set(resolvedCacheKey, entry)
  if (resolvedCacheKey !== cacheKey) {
    decisionResolutionCache.set(cacheKey, entry)
  }
  pruneCache()

  return resolution
}
