/** Resolve AI OS live reasoning for Call Workspace (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { detectAdaptiveStrategyChanges } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a"
import { loadPendingAdaptiveEventsForLead } from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-relationship-event-record"
import type { GrowthOutreachLearningThemeWeight } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import { buildOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { loadOutreachSellerTruthForOrganization } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { enrichBusinessProfileFromMasterContextDocument } from "@/lib/growth/business-profile/equipify-master-context-ingestion"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveCanonicalHumanMemoryForLead } from "@/lib/growth/lead-memory/resolve-canonical-human-memory-for-lead"
import { buildCallWorkspaceAiosLiveReasoningSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-builder"
import type { CallWorkspaceAiosLiveReasoningSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import {
  buildLiveTranscriptText,
  resolveLatestProspectSequenceNumber,
} from "@/lib/growth/operator-assist/call-workspace-aios-live-signals"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import { loadSequenceOptimizationOutreachSignals } from "@/lib/growth/sequence-optimization/sequence-optimization-queries"
import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"

const LIVE_REASONING_CACHE_TTL_MS = 4_000
const LIVE_REASONING_CACHE_MAX_ENTRIES = 300

type LiveReasoningCacheEntry = {
  expiresAt: number
  sequenceNumber: number | null
  snapshot: CallWorkspaceAiosLiveReasoningSnapshot
}

const liveReasoningCache = new Map<string, LiveReasoningCacheEntry>()

function pruneLiveReasoningCache(now = Date.now()): void {
  for (const [key, entry] of liveReasoningCache) {
    if (entry.expiresAt <= now) liveReasoningCache.delete(key)
  }
  while (liveReasoningCache.size > LIVE_REASONING_CACHE_MAX_ENTRIES) {
    const oldestKey = liveReasoningCache.keys().next().value
    if (!oldestKey) return
    liveReasoningCache.delete(oldestKey)
  }
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

export async function resolveCallWorkspaceAiosLiveReasoning(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    liveSnapshot: GrowthRealtimeLiveSnapshot | null
    voiceTranscript: VoiceCallTranscriptSnapshot | null
    generatedAt?: string
    realtimeSessionId?: string | null
  },
): Promise<CallWorkspaceAiosLiveReasoningSnapshot | null> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const sequenceNumber = resolveLatestProspectSequenceNumber({
    liveSnapshot: input.liveSnapshot,
    voiceTranscript: input.voiceTranscript,
  })

  const cacheKey = `${input.leadId}:${input.realtimeSessionId ?? "none"}`
  const cached = liveReasoningCache.get(cacheKey)
  if (
    cached &&
    cached.expiresAt > Date.now() &&
    cached.sequenceNumber === sequenceNumber &&
    sequenceNumber != null
  ) {
    return cached.snapshot
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return null

  const [decisionMakers, canonicalPackage, learningWeights] = await Promise.all([
    listGrowthLeadDecisionMakers(admin, input.leadId).catch(() => []),
    resolveCanonicalOutreachPackageForLead(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
    }).catch(() => null),
    resolveLearningWeights(admin, generatedAt),
  ])

  const memoryBundle = await resolveCanonicalHumanMemoryForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt,
    packageSnapshot: canonicalPackage,
    skipPackageLoad: true,
    liveDeltas: await loadPendingAdaptiveEventsForLead(admin, input.leadId).catch(() => []),
  })

  const leadMemory = memoryBundle.influence
  const buyingCommitteeSnapshot = memoryBundle.committee
  const relationshipContext = memoryBundle.relationshipContext
  const institutionalLearning = memoryBundle.institutionalAdvisory
  const institutionalAdvice = memoryBundle.institutionalAdvice
  const adaptiveEvents = memoryBundle.liveDeltas

  const primaryDm =
    decisionMakers.find((row) => row.id === lead.primaryDecisionMakerId) ?? decisionMakers[0] ?? null

  const profileRecord = await getActiveApprovedBusinessProfile(admin, input.organizationId).catch(() => null)
  const enrichedProfile = profileRecord?.profile
    ? enrichBusinessProfileFromMasterContextDocument(profileRecord.profile, {
        ingestedAt: generatedAt,
      })
    : null

  const sellerTruth = await loadOutreachSellerTruthForOrganization(admin, {
    organizationId: input.organizationId,
    preparedAt: generatedAt,
    prospectIndustry: null,
    prospectCompanyName: lead.companyName,
    leadId: input.leadId,
  })

  const researchRun = await fetchLatestCompletedProspectResearchRun(admin, input.leadId).catch(() => null)
  const prospectKnowledgePack = researchRun?.signals?.prospectKnowledgePack_v25c ?? null

  const brief =
    memoryBundle.packageSnapshot ??
    canonicalPackage?.salesStrategyBrief ??
    buildOutreachSalesStrategyBrief({
      leadId: input.leadId,
      companyName: lead.companyName ?? "this company",
      preparedAt: generatedAt,
      contactName: primaryDm?.fullName ?? lead.contactName,
      contactTitle: primaryDm?.title ?? lead.contactTitle,
      relationshipStrengthTier: lead.relationshipStrengthTier,
      contactTemperature: lead.contactTemperature,
      leadStatus: lead.status,
      hasMeetingScheduled: Boolean(lead.followUpAt),
      sellerTruth,
      approvedProfile: enrichedProfile,
      approvedProfileId: profileRecord?.id ?? null,
      sellerCompanyName: enrichedProfile?.company?.companyName ?? sellerTruth.sellerCompanyName,
      biEnrichmentLines: [],
      organizationalKnowledge: [],
      knowledgeCenterLines: [],
      industryPlaybook: null,
      industry: sellerTruth.industries[0] ?? null,
      equipmentServiced: lead.fieldServiceStackDetected ? [lead.fieldServiceStackDetected] : [],
      verifiedEvidence: [],
      missingEvidence: [],
      assumptions: [],
      prospectKnowledgePack,
      website: lead.website,
      learningWeights,
      relationshipAssessment: canonicalPackage?.salesStrategyBrief?.relationshipAssessment ?? null,
      institutionalLearning: null,
    })

  const leadSignals = {
    relationshipStrengthScore: lead.relationshipStrengthScore,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    relationshipTrend: lead.relationshipTrend,
    sequenceFatigueRisk: lead.sequenceFatigueRisk,
    leadStatus: lead.status,
    hasMeetingScheduled: Boolean(lead.followUpAt && /meeting/i.test(lead.nextBestActionReason ?? "")),
    isCustomer: /customer|won|converted/i.test(lead.status),
    isSuppressed: /suppress|dnc|do not contact/i.test(lead.status ?? ""),
    committeeMemberCount: buyingCommitteeSnapshot?.verifiedMemberCount,
    singleThreadRisk: buyingCommitteeSnapshot?.singleThreadRisk,
  }

  const snapshot = buildCallWorkspaceAiosLiveReasoningSnapshot({
    generatedAt,
    leadId: input.leadId,
    companyName: lead.companyName ?? "this company",
    brief,
    leadMemory,
    relationshipContext,
    leadSignals,
    buyingCommitteeSnapshot,
    institutionalLearning,
    institutionalAdvice,
    learningWeights,
    adaptiveEvents,
    liveSnapshot: input.liveSnapshot,
    voiceTranscript: input.voiceTranscript,
    transcriptText: buildLiveTranscriptText({ voiceTranscript: input.voiceTranscript }),
  })

  liveReasoningCache.set(cacheKey, {
    expiresAt: Date.now() + LIVE_REASONING_CACHE_TTL_MS,
    sequenceNumber,
    snapshot,
  })
  pruneLiveReasoningCache()

  logVoiceInfrastructure("call_workspace_aios_live_reasoning", {
    leadId: input.leadId,
    realtimeSessionId: input.realtimeSessionId ?? null,
    sequenceNumber,
    recommendation: snapshot.sayThisNext.recommendedNextSentence.slice(0, 120),
    confidence: snapshot.sayThisNext.confidence,
    conversationStage: snapshot.conversationStage,
    committeeStatus: snapshot.committeeStatus,
    adaptiveEventCount: adaptiveEvents.length,
    strategyChanged: detectAdaptiveStrategyChanges({
      previousAssessment: brief.relationshipAssessment,
      currentAssessment: snapshot.relationshipAssessment,
      previousRevenue: brief.revenueStrategyIntelligence,
      events: adaptiveEvents,
    }).meaningfulChanges.length,
  })

  return snapshot
}
