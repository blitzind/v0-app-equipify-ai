/**
 * GE-AIOS-RUNTIME-CONTEXT-1A — Request-scoped Runtime Context (server-only).
 *
 * Coordinates existing canonical resolvers so each expensive object resolves at most
 * once per request. Not a cache, orchestrator, or AI engine.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { resolveGrowthCanonicalDecisionForLeadCached } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { resolveCanonicalHumanMemoryForLead } from "@/lib/growth/lead-memory/resolve-canonical-human-memory-for-lead"
import type { CanonicalHumanMemoryBundle } from "@/lib/growth/lead-memory/canonical-human-memory-types"
import {
  GROWTH_AIOS_RUNTIME_CONTEXT_1A_QA_MARKER,
  type GrowthAiOsRuntimeResolutionCounts,
  type GrowthAiOsRuntimeRequestBoundary,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-context-1a-types"

export type GrowthAiOsRuntimeContextInput = {
  organizationId: string
  leadId: string
  boundary?: GrowthAiOsRuntimeRequestBoundary
  cacheScope?: string | null
  generatedAt?: string
  companyName?: string | null
  packageSnapshot?: GrowthAutonomousOutreachApprovalPackage | null
  materialEvent?: { id?: string | null; at?: string | null; kind?: string | null } | null
  researchSnapshot?: GrowthLeadResearchWorkflowSnapshot | null
  liveDeltas?: AdaptiveProspectEvent[]
  bypassDecisionCache?: boolean
}

export type GrowthAiOsRuntimeContext = {
  readonly qaMarker: typeof GROWTH_AIOS_RUNTIME_CONTEXT_1A_QA_MARKER
  readonly organizationId: string
  readonly leadId: string
  readonly boundary: GrowthAiOsRuntimeRequestBoundary | null
  readonly resolutionCounts: Readonly<GrowthAiOsRuntimeResolutionCounts>
  getPackage: () => Promise<GrowthAutonomousOutreachApprovalPackage | null>
  getMemory: () => Promise<CanonicalHumanMemoryBundle | null>
  getDecision: () => Promise<GrowthCanonicalDecisionResolution | null>
  getCommittee: () => Promise<CanonicalHumanMemoryBundle["committee"] | null>
  getInstitutional: () => Promise<CanonicalHumanMemoryBundle["institutionalAdvisory"] | null>
  getRelationship: () => Promise<CanonicalHumanMemoryBundle["relationshipContext"] | null>
  getSalesStrategyBrief: () => Promise<CanonicalHumanMemoryBundle["packageSnapshot"] | null>
  snapshotResolutionCounts: () => GrowthAiOsRuntimeResolutionCounts
}

function emptyCounts(): GrowthAiOsRuntimeResolutionCounts {
  return {
    decision: 0,
    memory: 0,
    package: 0,
    committee: 0,
    institutional: 0,
    meeting: 0,
  }
}

/**
 * Create a request-scoped Runtime Context for one account.
 * One context per request boundary — never share across unrelated accounts.
 */
export function createGrowthAiOsRuntimeContext(
  admin: SupabaseClient,
  input: GrowthAiOsRuntimeContextInput,
): GrowthAiOsRuntimeContext {
  const counts = emptyCounts()

  let packagePromise: Promise<GrowthAutonomousOutreachApprovalPackage | null> | null = null
  let memoryPromise: Promise<CanonicalHumanMemoryBundle | null> | null = null
  let decisionPromise: Promise<GrowthCanonicalDecisionResolution | null> | null = null

  const resolvePackage = (): Promise<GrowthAutonomousOutreachApprovalPackage | null> => {
    if (input.packageSnapshot != null) {
      if (counts.package === 0) counts.package = 1
      return Promise.resolve(input.packageSnapshot)
    }
    if (!packagePromise) {
      counts.package += 1
      packagePromise = resolveCanonicalOutreachPackageForLead(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
      }).catch(() => null)
    }
    return packagePromise
  }

  const resolveMemory = (): Promise<CanonicalHumanMemoryBundle | null> => {
    if (!memoryPromise) {
      counts.memory += 1
      memoryPromise = resolvePackage()
        .then((pkg) =>
          resolveCanonicalHumanMemoryForLead(admin, {
            organizationId: input.organizationId,
            leadId: input.leadId,
            generatedAt: input.generatedAt,
            companyName: input.companyName,
            researchSnapshot: input.researchSnapshot,
            packageSnapshot: pkg ?? input.packageSnapshot ?? undefined,
            skipPackageLoad: true,
            liveDeltas: input.liveDeltas,
          }),
        )
        .catch(() => null)
    }
    return memoryPromise
  }

  const resolveDecision = (): Promise<GrowthCanonicalDecisionResolution | null> => {
    if (!decisionPromise) {
      counts.decision += 1
      decisionPromise = Promise.all([resolvePackage(), resolveMemory()])
        .then(([pkg, memory]) =>
          resolveGrowthCanonicalDecisionForLeadCached(admin, {
            organizationId: input.organizationId,
            leadId: input.leadId,
            generatedAt: input.generatedAt,
            materialEvent: input.materialEvent?.id ?? input.materialEvent?.at ?? null,
            packageSnapshot: pkg ?? input.packageSnapshot ?? undefined,
            preloadedMemoryBundle: memory ?? undefined,
            cacheScope: input.cacheScope ?? "runtime-context",
            bypassCache: input.bypassDecisionCache,
          }),
        )
        .catch(() => null)
    }
    return decisionPromise
  }

  return {
    qaMarker: GROWTH_AIOS_RUNTIME_CONTEXT_1A_QA_MARKER,
    organizationId: input.organizationId,
    leadId: input.leadId,
    boundary: input.boundary ?? null,
    resolutionCounts: counts,

    getPackage: resolvePackage,
    getMemory: resolveMemory,
    getDecision: resolveDecision,

    async getCommittee() {
      const memory = await resolveMemory()
      if (memory?.committee) counts.committee += 1
      return memory?.committee ?? null
    },

    async getInstitutional() {
      const memory = await resolveMemory()
      if (memory?.institutionalAdvisory) counts.institutional += 1
      return memory?.institutionalAdvisory ?? null
    },

    async getRelationship() {
      const memory = await resolveMemory()
      return memory?.relationshipContext ?? null
    },

    async getSalesStrategyBrief() {
      const memory = await resolveMemory()
      return memory?.packageSnapshot ?? null
    },

    snapshotResolutionCounts() {
      return { ...counts }
    },
  }
}
