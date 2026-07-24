/**
 * AVA-DIRECT-PRODUCTION-CUTOVER-1A — Persist Ava companyUnderstanding after reasoning.
 * Optional organizational memory — not a prerequisite for reasoning.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { FuzorCompanyBusinessUnderstanding } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"
import { AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-direct/equipify-ava-direct-reasoning"

/** Minimal CI-shaped artifact for append-only memory without a separate GPT CI call. */
export function wrapAvaUnderstandingForMemory(input: {
  companyUnderstanding: string
  websiteSourceUrls: string[]
}): FuzorCompanyBusinessUnderstanding {
  const summary = input.companyUnderstanding.trim()
  const evidence = input.websiteSourceUrls.slice(0, 8)
  return {
    executiveSummary: summary,
    revenueModel: {
      summary: "Derived from Ava direct reasoning — not separately structured.",
      models: [],
      evidence,
    },
    productsAndServices: {
      offerings: [],
      notes: null,
      evidence,
    },
    operationalModel: {
      summary: summary.slice(0, 2000),
      characteristics: [],
      evidence,
    },
    customers: {
      summary: "Not separately structured in Ava direct memory artifact.",
      segments: [],
      evidence,
    },
    industriesServed: {
      industries: [],
      evidence,
    },
    operationalChallenges: { challenges: [] },
    companyStrengths: { strengths: [], evidence: [] },
    unknowns: [],
    evidenceUsed: evidence.length ? evidence : [summary.slice(0, 500)],
    evidenceWeakness: null,
  }
}

export type PersistAvaUnderstandingMemoryInput = {
  admin: SupabaseClient
  ownerOrganizationId: string
  leadId: string
  companyId: string | null
  companyName: string
  website: string | null
  companyUnderstanding: string
  websiteSourceUrls: string[]
  model: string | null
  promptVersion: string
  aiDeploymentId?: string | null
}

/**
 * Best-effort memory persist. Failures are logged and do not block Ava's decision.
 * Full CI schema simplification recommended in a later milestone.
 */
export async function persistAvaUnderstandingMemory(
  input: PersistAvaUnderstandingMemoryInput,
): Promise<{ ok: true; versionId: string | null } | { ok: false; message: string }> {
  try {
    const { insertFuzorCompanyIntelligenceVersion, isFuzorCompanyIntelligenceVersionsSchemaReady } =
      await import(
        "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-repository"
      )

    if (!(await isFuzorCompanyIntelligenceVersionsSchemaReady(input.admin))) {
      logGrowthEngine("ava_direct_understanding_memory_skipped", {
        leadId: input.leadId,
        reason: "ci_schema_not_ready",
      })
      return { ok: true, versionId: null }
    }

    if (!input.companyId) {
      logGrowthEngine("ava_direct_understanding_memory_skipped", {
        leadId: input.leadId,
        reason: "no_company_id",
      })
      return { ok: true, versionId: null }
    }

    const understanding = wrapAvaUnderstandingForMemory({
      companyUnderstanding: input.companyUnderstanding,
      websiteSourceUrls: input.websiteSourceUrls,
    })

    const fingerprint = `ava-direct-${input.promptVersion}-${understanding.executiveSummary.length}`

    const record = await insertFuzorCompanyIntelligenceVersion(input.admin, {
      ownerOrganizationId: input.ownerOrganizationId,
      aiDeploymentId: input.aiDeploymentId ?? null,
      companyId: input.companyId,
      leadId: input.leadId,
      companyName: input.companyName,
      website: input.website,
      model: input.model ?? "gpt-5.5",
      modelVersion: null,
      promptVersion: input.promptVersion,
      companyIntelligenceVersion: "ava-direct-memory-v1",
      evidenceVersion: fingerprint.slice(0, 16),
      evidenceFingerprint: fingerprint,
      understanding,
      evidenceRefs: {
        leadId: input.leadId,
        website: input.website,
        linkedinCompanyUrl: null,
        hasVerifiedDescription: true,
        verifiedOfferingCount: 0,
        verifiedIndustryCount: 0,
        websiteExcerptCount: input.websiteSourceUrls.length,
        pagesObserved: input.websiteSourceUrls.map((url) => ({
          url,
          pageType: "retrieved",
          status: "crawled",
        })),
        datamoonFindingCount: 0,
        missingFromCollection: [],
        priorResearchNotesPresent: false,
      },
      generationMetadata: {
        source: "ava_direct_reasoning_memory",
        qaMarker: AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER,
      },
      generationDurationMs: null,
      promptTokens: null,
      completionTokens: null,
      qaMarker: AVA_DIRECT_PRODUCTION_CUTOVER_1A_QA_MARKER,
      generationMode: "ava_direct_understanding_memory_1a",
    })

    return { ok: true, versionId: record.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Memory persist failed."
    logGrowthEngine("ava_direct_understanding_memory_failed", {
      leadId: input.leadId,
      message,
    })
    return { ok: false, message }
  }
}
