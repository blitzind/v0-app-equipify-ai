/** GE-AIOS-MEMORY-RESOLVER-1A — Canonical human memory resolver (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import type { GrowthOutreachLearningThemeWeight } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import {
  extractVerifiedCompanyNameFromEvidence,
  extractWebsiteBrandingName,
  resolveCanonicalDisplayIdentity,
  resolveCanonicalCompanyDisplayName,
  resolveAuthoritativeForm,
} from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"
import { resolveInstitutionalSalesIntelligenceForOrganization } from "@/lib/growth/aios/growth/growth-institutional-learning-1a-resolver"
import { loadPendingAdaptiveEventsForLead } from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-relationship-event-record"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import {
  buildRelationshipAssessmentContextFromPacket,
  loadInstitutionalAdviceSnippets,
} from "@/lib/growth/aios/growth/growth-relationship-strategy-2a"
import { loadBuyingCommitteeIntelligenceLeadRollup } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-lead-rollup"
import { loadBuyingCommitteeIntelligenceOperatorStatus } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-operator-status"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { enrichBusinessProfileFromMasterContextDocument } from "@/lib/growth/business-profile/equipify-master-context-ingestion"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchLeadMemoryProfileView } from "@/lib/growth/lead-memory/dashboard"
import {
  buildCanonicalRecordsFromProfileView,
  resolveCurrentConclusions,
} from "@/lib/growth/lead-memory/canonical-human-memory-evolution"
import { institutionalAdviceMustNotOverrideAccountFact } from "@/lib/growth/lead-memory/canonical-human-memory-constitution"
import {
  buildActionMemorySlice,
  buildBusinessMemorySlice,
  buildPersonalMemorySlice,
  buildRelationshipMemorySlice,
  buildSalesMemorySlice,
} from "@/lib/growth/lead-memory/canonical-human-memory-slices"
import {
  GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER,
  type CanonicalHumanMemoryBundle,
} from "@/lib/growth/lead-memory/canonical-human-memory-types"
import { projectLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-projection"
import { buildOutreachContextPacket } from "@/lib/growth/outreach/personalization/context-packet-builder"
import { loadOutreachSellerTruthForOrganization } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import { loadSequenceOptimizationOutreachSignals } from "@/lib/growth/sequence-optimization/sequence-optimization-queries"

async function resolveBuyingCommitteeSnapshot(admin: SupabaseClient, leadId: string) {
  const bcRollup = await loadBuyingCommitteeIntelligenceLeadRollup(admin, leadId).catch(() => null)
  const bcStatus =
    bcRollup?.company_id != null
      ? await loadBuyingCommitteeIntelligenceOperatorStatus(admin, {
          company_id: bcRollup.company_id,
        }).catch(() => null)
      : null

  if (bcRollup && bcStatus) {
    return {
      hasVerifiedCommittee: bcStatus.has_verified_committee,
      discoveryPending: bcRollup.discovery_pending,
      discoveryFailed: bcRollup.discovery_failed,
      singleThreadRisk: bcStatus.single_thread_risk,
      coverageScore: bcStatus.coverage_score,
      rolesPresent: bcStatus.roles_present,
      rolesMissing: bcStatus.roles_missing,
      verifiedMemberCount: bcStatus.verified_member_count,
    }
  }

  if (bcRollup) {
    return {
      hasVerifiedCommittee: bcRollup.has_verified_committee,
      discoveryPending: bcRollup.discovery_pending,
      discoveryFailed: bcRollup.discovery_failed,
      singleThreadRisk: true,
      coverageScore: 0,
      rolesPresent: [],
      rolesMissing: [],
      verifiedMemberCount: 0,
    }
  }

  return null
}

async function resolveLearningWeights(
  admin: SupabaseClient,
  generatedAt: string,
): Promise<GrowthOutreachLearningThemeWeight[] | null> {
  try {
    const generatedMs = Date.parse(generatedAt)
    const dateFrom = new Date(generatedMs - 90 * 86400000).toISOString()
    const outreachSignals = await loadSequenceOptimizationOutreachSignals(admin, {
      dateFrom,
      dateTo: generatedAt,
      channel: null,
      repUserId: null,
      sequenceId: null,
      attributionModel: "last_touch",
    })
    return outreachSignals.openerSignals.map((row) => ({
      themeKey: row.key,
      replyRatePct: row.replyRatePct,
      sends: row.sends,
    }))
  } catch {
    return null
  }
}

export async function resolveCanonicalHumanMemoryForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generatedAt?: string
    researchSnapshot?: GrowthLeadResearchWorkflowSnapshot | null
    packageSnapshot?: GrowthAutonomousOutreachApprovalPackage | null
    skipPackageLoad?: boolean
    liveDeltas?: AdaptiveProspectEvent[]
    companyName?: string | null
  },
): Promise<CanonicalHumanMemoryBundle> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    throw new Error("Lead not found for canonical human memory resolution.")
  }

  const companyNameRaw = lead.companyName ?? input.companyName ?? "this company"

  const [
    profileView,
    contextPacket,
    loadedPackage,
    pendingAdaptiveEvents,
    decisionMakers,
    buyingCommitteeSnapshot,
    sellerTruth,
    profileRecord,
    researchRun,
    learningWeights,
  ] = await Promise.all([
    fetchLeadMemoryProfileView(admin, input.leadId).catch(() => null),
    buildOutreachContextPacket(admin, lead).catch(() => null),
    input.skipPackageLoad
      ? Promise.resolve(null)
      : input.packageSnapshot != null
        ? Promise.resolve(input.packageSnapshot)
        : resolveCanonicalOutreachPackageForLead(admin, {
            organizationId: input.organizationId,
            leadId: input.leadId,
          }).catch(() => null),
    input.liveDeltas != null
      ? Promise.resolve(input.liveDeltas)
      : loadPendingAdaptiveEventsForLead(admin, input.leadId).catch(() => []),
    listGrowthLeadDecisionMakers(admin, input.leadId).catch(() => []),
    resolveBuyingCommitteeSnapshot(admin, input.leadId),
    loadOutreachSellerTruthForOrganization(admin, {
      organizationId: input.organizationId,
      preparedAt: generatedAt,
      prospectIndustry: null,
      prospectCompanyName: companyNameRaw,
      leadId: input.leadId,
    }),
    getActiveApprovedBusinessProfile(admin, input.organizationId).catch(() => null),
    fetchLatestCompletedProspectResearchRun(admin, input.leadId).catch(() => null),
    resolveLearningWeights(admin, generatedAt),
  ])

  const primaryDm =
    decisionMakers.find((row) => row.id === lead.primaryDecisionMakerId) ?? decisionMakers[0] ?? null

  const snapshot = input.researchSnapshot ?? null
  const verifiedEvidence = snapshot?.evidenceSummary?.verifiedEvidence ?? []
  const prospectKnowledgePack = researchRun?.signals?.prospectKnowledgePack_v25c ?? null
  const enrichedProfile = profileRecord?.profile
    ? enrichBusinessProfileFromMasterContextDocument(profileRecord.profile, { ingestedAt: generatedAt })
    : null

  const canonicalDisplayIdentity =
    loadedPackage?.canonicalDisplayIdentity ??
    resolveCanonicalDisplayIdentity({
      originalCompanyName: companyNameRaw,
      verifiedCanonicalCompanyName: extractVerifiedCompanyNameFromEvidence(verifiedEvidence),
      websiteBrandingName: extractWebsiteBrandingName({
        website: lead.website,
        verifiedEvidence,
        prospectKnowledgePackCompanyName:
          (prospectKnowledgePack as { companyName?: string | null } | null)?.companyName ?? null,
      }),
      crmCompanyName: lead.companyName ?? input.companyName,
      prospectResearchCompanyName: extractVerifiedCompanyNameFromEvidence(verifiedEvidence),
      operatorCompanyOverride: loadedPackage?.canonicalDisplayIdentity?.operatorOverrides?.company ?? null,
      preserveOperatorOverrides: loadedPackage?.canonicalDisplayIdentity?.operatorOverrides ?? null,
      contactName: primaryDm?.fullName ?? lead.contactName,
      sellerCompanyName: enrichedProfile?.company?.companyName ?? sellerTruth.sellerCompanyName,
      sellerWebsite: enrichedProfile?.company?.website ?? sellerTruth.website,
      productNames: enrichedProfile?.company?.productsServices ?? [],
    })

  const companyName = resolveCanonicalCompanyDisplayName(canonicalDisplayIdentity, companyNameRaw)
  const identityCompanyLabel = resolveAuthoritativeForm(companyName)

  const rawRecords = buildCanonicalRecordsFromProfileView(profileView, identityCompanyLabel)
  const { active, suppressedLowConfidence, expiredPersonal } = resolveCurrentConclusions(rawRecords)

  const equipment = [
    ...(lead.fieldServiceStackDetected ? [lead.fieldServiceStackDetected] : []),
    ...active
      .filter((record) => /mri|ct|imaging|equipment|fleet/i.test(record.conclusion))
      .map((record) => record.conclusion),
  ]

  const business = buildBusinessMemorySlice({
    records: active,
    companyName: identityCompanyLabel,
    industry: sellerTruth.industries[0] ?? null,
    equipment,
  })
  const personal = buildPersonalMemorySlice(active)
  const relationship = buildRelationshipMemorySlice({
    records: active,
    profileView,
    priorReplySummaries: contextPacket?.priorReplySummaries ?? [],
    memoryOpenLoopSummaries: contextPacket?.memoryOpenLoopSummaries ?? [],
  })
  const sales = buildSalesMemorySlice(active)
  const actions = buildActionMemorySlice(active)

  const influence = projectLeadMemoryInfluenceContext(profileView)

  const institutionalLearning = await resolveInstitutionalSalesIntelligenceForOrganization(admin, {
    organizationId: input.organizationId,
    generatedAt,
    accountContext: {
      companyName: identityCompanyLabel,
      industry: sellerTruth.industries[0] ?? null,
      contactTitle: primaryDm?.title ?? lead.contactTitle,
      companySize: lead.estimatedEmployeeCount,
      employeeCount: lead.estimatedEmployeeCount,
      relationshipStage: lead.relationshipStrengthTier,
      accountEvidenceThemes: verifiedEvidence,
      businessPressureKey:
        loadedPackage?.salesStrategyBrief?.consultantDiscoveryIntelligence?.primaryBusinessPressure?.key ??
        null,
      messageThemeKey:
        loadedPackage?.salesStrategyBrief?.evidenceIntelligence?.selectedObservation?.themeKey ?? null,
    },
    canonicalDisplayIdentity,
  })

  const accountFacts = [
    ...business.currentSoftware,
    ...business.growthInitiatives,
    ...business.operationalPriorities,
    companyName,
  ].filter(Boolean)

  const institutionalAdvice = loadInstitutionalAdviceSnippets({
    industry: sellerTruth.industries[0] ?? null,
    institutionalIntelligence: institutionalLearning,
  }).filter((line) => institutionalAdviceMustNotOverrideAccountFact(line, accountFacts))

  const relationshipContext = contextPacket
    ? buildRelationshipAssessmentContextFromPacket({
        priorTouchCount: contextPacket.priorTouchCount,
        priorReplySummaries: contextPacket.priorReplySummaries,
        priorOutboundSubjects: contextPacket.priorOutboundSubjects,
        objectionSummaries: contextPacket.objectionSummaries,
        sequenceHistorySummaries: contextPacket.sequenceHistorySummaries,
        memoryOpenLoopSummaries: contextPacket.memoryOpenLoopSummaries,
        buyingIntent: contextPacket.buyingIntent,
        competitorPressure: contextPacket.competitorPressure,
      })
    : {
        priorTouchCount: 0,
        priorReplyCount: 0,
        priorOutboundSubjects: [],
        objectionSummaries: [],
        priorReplySummaries: [],
        sequenceHistorySummaries: [],
        memoryOpenLoopSummaries: [],
        buyingIntent: null,
        competitorPressure: null,
      }

  const packageBrief = loadedPackage?.salesStrategyBrief ?? null
  const packagePreparedAt = packageBrief?.preparedAt ?? loadedPackage?.preparedAt ?? null
  const stalePackageSnapshot =
    packagePreparedAt != null
      ? Date.parse(generatedAt) - Date.parse(packagePreparedAt) > 14 * 86400000
      : false

  const operatorApprovedCount = active.filter(
    (record) =>
      record.operatorStatus === "approved" ||
      record.operatorStatus === "corrected" ||
      record.operatorStatus === "pinned" ||
      record.operatorStatus === "protected",
  ).length

  return {
    qaMarker: GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER,
    leadId: input.leadId,
    organizationId: input.organizationId,
    generatedAt,
    identity: canonicalDisplayIdentity,
    influence,
    business,
    personal,
    relationship,
    sales,
    actions,
    committee: buyingCommitteeSnapshot,
    institutionalAdvisory: institutionalLearning,
    packageSnapshot: packageBrief,
    liveDeltas: pendingAdaptiveEvents,
    freshness: {
      generatedAt,
      totalActiveRecords: active.length,
      expiredPersonalSensitivityCount: expiredPersonal,
      lowConfidenceSuppressedCount: suppressedLowConfidence,
      operatorApprovedCount,
      stalePackageSnapshot,
    },
    relationshipContext,
    learningWeights,
    institutionalAdvice,
    profileViewAvailable: profileView != null,
  }
}
