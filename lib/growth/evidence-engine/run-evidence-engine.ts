/** GE-AIOS-8A-1/8A-2 — Canonical Evidence Engine entry point (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { detectEvidenceContradictions } from "@/lib/growth/evidence-engine/evidence-contradiction-detector"
import {
  buildEvidenceEngineInputHash,
  EVIDENCE_ENGINE_EXTRACTION_VERSION,
} from "@/lib/growth/evidence-engine/evidence-engine-input-hash"
import {
  assertNoUnsupportedActions,
  mergeEvidenceItems,
  mergeNormalizedFacts,
  normalizeEvidenceCollectionResult,
  normalizeProviderCollection,
} from "@/lib/growth/evidence-engine/evidence-normalizer"
import {
  fetchCachedEvidenceEngineRunByInputHash,
  fetchLatestEvidenceEngineSnapshot,
  persistEvidenceEngineRunBundle,
} from "@/lib/growth/evidence-engine/evidence-engine-repository"
import type {
  EvidenceCollectionResult,
  EvidenceEngineProvider,
  EvidenceEngineRunInput,
  EvidenceEngineRunResult,
} from "@/lib/growth/evidence-engine/evidence-engine-types"
import { collectApprovedProfileEvidence } from "@/lib/growth/evidence-engine/providers/approved-profile-evidence-provider"
import { collectWebsiteEvidence } from "@/lib/growth/evidence-engine/providers/website-evidence-provider"

const DEFAULT_PROVIDERS: EvidenceEngineProvider[] = ["website", "approved_profile"]

export type RunEvidenceEngineDeps = {
  collectWebsiteEvidence?: typeof collectWebsiteEvidence
  collectApprovedProfileEvidence?: typeof collectApprovedProfileEvidence
  getActiveApprovedBusinessProfile?: typeof getActiveApprovedBusinessProfile
  fetchCachedEvidenceEngineRunByInputHash?: typeof fetchCachedEvidenceEngineRunByInputHash
  fetchLatestEvidenceEngineSnapshot?: typeof fetchLatestEvidenceEngineSnapshot
  persistEvidenceEngineRunBundle?: typeof persistEvidenceEngineRunBundle
}

export type RunEvidenceEngineInput = EvidenceEngineRunInput & {
  admin: SupabaseClient
  deps?: RunEvidenceEngineDeps
}

async function runWebsiteProvider(
  input: RunEvidenceEngineInput,
  websiteUrl: string | null,
  collectWebsiteEvidenceImpl: typeof collectWebsiteEvidence,
): Promise<EvidenceCollectionResult> {
  const provider: EvidenceEngineProvider = "website"

  if (!websiteUrl) {
    return normalizeEvidenceCollectionResult({
      organization_id: input.organizationId,
      provider,
      evidence: [],
      facts: [],
      contradictions: [],
      warnings: ["Website evidence provider skipped: no website URL available."],
      diagnostics: { provider, skipped: true },
    })
  }

  const providerOutput = await collectWebsiteEvidenceImpl({
    organizationId: input.organizationId,
    websiteUrl,
    forceRefresh: input.forceRefresh,
  })

  const normalized = normalizeProviderCollection(providerOutput)

  return normalizeEvidenceCollectionResult({
    organization_id: input.organizationId,
    provider,
    evidence: normalized.evidence,
    facts: normalized.facts,
    contradictions: [],
    warnings: [...normalized.warnings, ...providerOutput.warnings],
    diagnostics: providerOutput.diagnostics,
  })
}

async function runApprovedProfileProvider(
  input: RunEvidenceEngineInput,
  collectApprovedProfileEvidenceImpl: typeof collectApprovedProfileEvidence,
): Promise<EvidenceCollectionResult> {
  const provider: EvidenceEngineProvider = "approved_profile"

  const providerOutput = await collectApprovedProfileEvidenceImpl({
    admin: input.admin,
    organizationId: input.organizationId,
  })

  const normalized = normalizeProviderCollection(providerOutput)

  return normalizeEvidenceCollectionResult({
    organization_id: input.organizationId,
    provider,
    evidence: normalized.evidence,
    facts: normalized.facts,
    contradictions: [],
    warnings: [...normalized.warnings, ...providerOutput.warnings],
    diagnostics: providerOutput.diagnostics,
  })
}

async function runProvider(
  provider: EvidenceEngineProvider,
  input: RunEvidenceEngineInput,
  websiteUrl: string | null,
  deps: RunEvidenceEngineDeps,
): Promise<EvidenceCollectionResult | null> {
  const collectWebsiteEvidenceImpl = deps.collectWebsiteEvidence ?? collectWebsiteEvidence
  const collectApprovedProfileEvidenceImpl =
    deps.collectApprovedProfileEvidence ?? collectApprovedProfileEvidence

  if (provider === "website") {
    return runWebsiteProvider(input, websiteUrl, collectWebsiteEvidenceImpl)
  }

  if (provider === "approved_profile") {
    return runApprovedProfileProvider(input, collectApprovedProfileEvidenceImpl)
  }

  return null
}

export async function runEvidenceEngine(input: RunEvidenceEngineInput): Promise<EvidenceEngineRunResult> {
  const providers = input.providers?.length ? input.providers : DEFAULT_PROVIDERS
  const websiteUrl = input.websiteUrl?.trim() || null
  const persist = input.persist === true
  const deps = input.deps ?? {}

  const loadApprovedProfile = deps.getActiveApprovedBusinessProfile ?? getActiveApprovedBusinessProfile
  const approvedProfile =
    providers.includes("approved_profile")
      ? await loadApprovedProfile(input.admin, input.organizationId)
      : null

  const inputHash = buildEvidenceEngineInputHash({
    organizationId: input.organizationId,
    websiteUrl,
    providers,
    extractionVersion: EVIDENCE_ENGINE_EXTRACTION_VERSION,
    approvedProfileId: approvedProfile?.id ?? null,
    approvedProfileUpdatedAt: approvedProfile?.approvedAt ?? approvedProfile?.updatedAt ?? null,
  })

  const warnings: string[] = []
  const diagnostics: Record<string, unknown> = {
    trigger: input.trigger,
    force_refresh: Boolean(input.forceRefresh),
    providers,
    input_hash: inputHash,
    extraction_version: EVIDENCE_ENGINE_EXTRACTION_VERSION,
    persistence: persist ? "database" : "in_memory_only",
  }

  if (persist && !input.forceRefresh) {
    const fetchCached = deps.fetchCachedEvidenceEngineRunByInputHash ?? fetchCachedEvidenceEngineRunByInputHash
    const fetchSnapshot = deps.fetchLatestEvidenceEngineSnapshot ?? fetchLatestEvidenceEngineSnapshot

    const cachedRun = await fetchCached(input.admin, {
      organization_id: input.organizationId,
      input_hash: inputHash,
    })
    const cachedSnapshot = await fetchSnapshot(input.admin, input.organizationId)

    if (cachedRun && cachedSnapshot && cachedSnapshot.run_id === cachedRun.run_id) {
      return {
        ok: true,
        organization_id: input.organizationId,
        trigger: input.trigger,
        collections: [],
        evidence: cachedSnapshot.snapshot.evidence ?? [],
        facts: cachedSnapshot.snapshot.facts,
        contradictions: cachedSnapshot.snapshot.contradictions,
        warnings: [...warnings, ...(cachedRun.warnings ?? []), "Returned cached Evidence Engine snapshot."],
        diagnostics: {
          ...diagnostics,
          cache_hit: true,
          cached_run_id: cachedRun.run_id,
          cached_snapshot_id: cachedSnapshot.snapshot_id,
        },
        run_id: cachedRun.run_id,
        snapshot_id: cachedSnapshot.snapshot_id,
        input_hash: inputHash,
        cached: true,
        persisted: true,
      }
    }
  }

  const collections: EvidenceCollectionResult[] = []

  for (const provider of providers) {
    if (provider === "fallback" || provider === "ai_inference") {
      warnings.push(`Provider ${provider} is not enabled in GE-AIOS-8A foundation phase.`)
      continue
    }

    const collection = await runProvider(provider, input, websiteUrl, deps)
    if (!collection) {
      warnings.push(`Provider ${provider} is not implemented.`)
      continue
    }
    collections.push(collection)
  }

  const evidence = mergeEvidenceItems(collections.flatMap((collection) => collection.evidence))
  const facts = mergeNormalizedFacts(collections.flatMap((collection) => collection.facts))

  const contradictionResult = detectEvidenceContradictions({
    organization_id: input.organizationId,
    facts,
    evidence,
  })

  assertNoUnsupportedActions({
    evidence: contradictionResult.evidence,
    facts: contradictionResult.facts,
  })

  for (const fact of contradictionResult.facts) {
    if (fact.supporting_evidence_ids.length === 0) {
      throw new Error(`Evidence Engine produced fact without evidence: ${fact.fact_key}`)
    }
  }

  const hasFallback = contradictionResult.evidence.some(
    (item) => item.provider === "fallback" || item.decision_tier === "fallback_assumption",
  )
  if (hasFallback) {
    throw new Error("Evidence Engine must not create fallback assumptions.")
  }

  const allWarnings = [
    ...warnings,
    ...collections.flatMap((collection) => collection.warnings),
    ...contradictionResult.warnings,
  ]

  let runId: string | null = null
  let snapshotId: string | null = null

  if (persist) {
    const persistBundle = deps.persistEvidenceEngineRunBundle ?? persistEvidenceEngineRunBundle
    const persisted = await persistBundle(input.admin, {
      organization_id: input.organizationId,
      trigger: input.trigger,
      input_hash: inputHash,
      extraction_version: EVIDENCE_ENGINE_EXTRACTION_VERSION,
      website_url: websiteUrl,
      providers,
      evidence: contradictionResult.evidence,
      facts: contradictionResult.facts,
      contradictions: contradictionResult.contradictions,
      warnings: allWarnings,
      diagnostics,
      metadata: {
        approved_profile_id: approvedProfile?.id ?? null,
      },
    })
    runId = persisted.run_id
    snapshotId = persisted.snapshot_id
  }

  return {
    ok: true,
    organization_id: input.organizationId,
    trigger: input.trigger,
    collections,
    evidence: contradictionResult.evidence,
    facts: contradictionResult.facts,
    contradictions: contradictionResult.contradictions,
    warnings: allWarnings,
    diagnostics,
    run_id: runId,
    snapshot_id: snapshotId,
    input_hash: inputHash,
    cached: false,
    persisted: persist,
  }
}
