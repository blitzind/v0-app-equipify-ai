/** GE-AIOS-INSTITUTIONAL-LEARNING-1A — Server resolver for organizational learning (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthClosedLoopLearningReadModel } from "@/lib/growth/aios/learning/growth-closed-loop-learning-service"
import {
  buildInstitutionalSalesIntelligence,
  type GrowthInstitutionalAccountContext,
} from "@/lib/growth/aios/growth/growth-institutional-learning-1a"
import type { GrowthInstitutionalSalesIntelligence } from "@/lib/growth/aios/growth/growth-institutional-learning-1a-types"
import { applyInstitutionalLearning1BRefinements } from "@/lib/growth/aios/growth/growth-institutional-learning-1b"
import type { GrowthCanonicalDisplayIdentity } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b-types"

export async function resolveInstitutionalSalesIntelligenceForOrganization(
  admin: SupabaseClient | null,
  input: {
    organizationId: string
    generatedAt: string
    accountContext: GrowthInstitutionalAccountContext
    canonicalDisplayIdentity?: GrowthCanonicalDisplayIdentity | null
  },
): Promise<GrowthInstitutionalSalesIntelligence> {
  const learning = await fetchGrowthClosedLoopLearningReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  })

  const base = buildInstitutionalSalesIntelligence({
    outcomes: learning.outcomes,
    insights: learning.insights,
    accountContext: input.accountContext,
    referenceAt: input.generatedAt,
  })

  return applyInstitutionalLearning1BRefinements({
    intelligence: base,
    outcomes: learning.outcomes,
    insights: learning.insights,
    accountContext: input.accountContext,
    referenceAt: input.generatedAt,
    canonicalIdentity: input.canonicalDisplayIdentity,
  })
}
