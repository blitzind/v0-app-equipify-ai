/**
 * GE-AIOS-SALES-PLAYBOOK-1B — Load seller knowledge for outreach brief (server-only).
 * Profile remains SoT. BI / Org Knowledge / Knowledge Center / Industry Playbooks enrich only.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { enrichBusinessProfileFromMasterContextDocument } from "@/lib/growth/business-profile/equipify-master-context-ingestion"
import { fetchLatestBusinessIntelligenceReport } from "@/lib/growth/business-intelligence/business-intelligence-repository"
import { isCanonicalSellerKnowledgeEnriched } from "@/lib/growth/training/canonical-seller-knowledge-onboarding-1a"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import { fetchOrganizationKnowledgeStore } from "@/lib/growth/memory/knowledge/organization-knowledge-repository"
import { runKnowledgeRetrieval } from "@/lib/growth/knowledge-center/knowledge-repository"
import { resolveIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-registry"
import {
  buildOutreachSellerTruth,
  extractBusinessIntelligenceEnrichmentLines,
  type GrowthOutreachSellerTruth,
} from "@/lib/growth/aios/growth/growth-outreach-seller-truth"

export async function loadOutreachSellerTruthForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    preparedAt: string
    prospectIndustry?: string | null
    prospectCompanyName?: string | null
    leadId?: string | null
  },
): Promise<GrowthOutreachSellerTruth> {
  const profileRecord = await getActiveApprovedBusinessProfile(
    admin,
    input.organizationId,
  ).catch(() => null)

  // Use stored approved profile directly when Training authority is complete; runtime merge only gap-fills thin profiles.
  const rawProfile = profileRecord?.profile ?? null
  const strategyCompleteness = evaluateBusinessStrategyCompleteness(rawProfile?.businessStrategy)
  const useApprovedProfileAsIs = Boolean(
    rawProfile &&
      (isCanonicalSellerKnowledgeEnriched(rawProfile) ||
        (strategyCompleteness.hasContent &&
          strategyCompleteness.filledSectionCount >= strategyCompleteness.totalSectionCount)),
  )
  const profile = rawProfile
    ? useApprovedProfileAsIs
      ? rawProfile
      : enrichBusinessProfileFromMasterContextDocument(rawProfile, {
          ingestedAt: input.preparedAt,
        })
    : null

  const biRecord = await fetchLatestBusinessIntelligenceReport(
    admin,
    input.organizationId,
  ).catch(() => null)
  const biLines = extractBusinessIntelligenceEnrichmentLines(biRecord?.report ?? null)

  const orgKnowledgePayload = await fetchOrganizationKnowledgeStore(admin, {
    organizationId: input.organizationId,
    generatedAt: input.preparedAt,
    limit: 40,
  }).catch(() => null)

  const knowledgeRetrieval = await runKnowledgeRetrieval(admin, {
    organization_id: input.organizationId,
    consumer: "sequence_builder",
    categories: ["playbook", "objection", "case_study", "product", "competitor", "training"],
    industry: input.prospectIndustry ?? undefined,
    lead_id: input.leadId ?? undefined,
    query: [input.prospectCompanyName, input.prospectIndustry, "outreach"].filter(Boolean).join(" "),
    limit: 5,
    include_private: false,
  }).catch(() => null)

  const knowledgeCenterLines =
    knowledgeRetrieval?.documents.map((doc) => {
      const title = doc.title?.trim() || "Knowledge document"
      const category = doc.category || "other"
      return `${category}: ${title}`
    }) ?? []

  const needsPlaybookFallback = Boolean(
    profile &&
      !(
        profile.businessStrategy?.objections?.items?.length ||
        profile.businessStrategy?.salesPhilosophy?.discoveryQuestions?.length ||
        profile.businessStrategy?.messaging?.ctaPreferences?.length ||
        profile.salesAndMarketing?.messagingAngles?.length
      ),
  )

  const industryHint =
    input.prospectIndustry ||
    profile?.idealCustomers.targetIndustries?.[0] ||
    null

  const playbook =
    needsPlaybookFallback || !profile
      ? resolveIndustryPlaybook({
          industry: industryHint,
          companyName: input.prospectCompanyName,
        }).playbook
      : null

  return buildOutreachSellerTruth({
    profileId: profileRecord?.id ?? null,
    profile,
    sellerCompanyName: profileRecord?.companyName ?? profile?.company.companyName ?? null,
    biEnrichmentLines: biLines,
    organizationalKnowledge: orgKnowledgePayload?.store.items ?? [],
    knowledgeCenterLines,
    industryPlaybook: playbook,
    prospectIndustry: input.prospectIndustry,
    prospectTitle: null,
  })
}
