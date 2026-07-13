/** GE-AIOS-GROWTH-5F / OUTREACH-QUALITY-1A / SALES-PLAYBOOK-1B — Strategy-first outreach prep (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { resolveOutreachPreparationConfidence } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-engine"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_ALLOWED_WORKFLOW } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  requestGrowthCommunicationPlan,
  resolveCommunicationPlanRecommendedChannel,
} from "@/lib/growth/aios/communication/growth-communication-engine-service"
import {
  buildOutreachSalesStrategyBrief,
  estimateReadTimeSeconds,
} from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import {
  generateOutreachDraftsFromSalesStrategyBrief,
  summarizeStrategyDerivedAssetsForPackage,
} from "@/lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { loadOutreachSellerTruthForOrganization } from "@/lib/growth/aios/growth/growth-outreach-seller-truth-loader"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { enrichBusinessProfileFromMasterContextDocument } from "@/lib/growth/business-profile/equipify-master-context-ingestion"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import { loadSequenceOptimizationOutreachSignals } from "@/lib/growth/sequence-optimization/sequence-optimization-queries"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import type { GrowthOutreachLearningThemeWeight } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import {
  mapRevenueStrategyChannelToPackage,
  mapRevenueStrategySequenceToPackage,
} from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import { mergeOperatorAssetStateFromPreviousPackage } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import { loadBuyingCommitteeIntelligenceLeadRollup } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-lead-rollup"
import { loadBuyingCommitteeIntelligenceOperatorStatus } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-operator-status"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { buildOutreachContextPacket } from "@/lib/growth/outreach/personalization/context-packet-builder"
import {
  applyAdaptiveLoopToOutreachPreparation,
  detectAdaptiveStrategyChanges,
  GROWTH_AIOS_ADAPTIVE_LOOP_1A_QA_MARKER,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1a"
import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import {
  loadPendingAdaptiveEventsForLead,
  markAdaptiveEventsProcessedForLead,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-relationship-event-record"
import {
  buildRelationshipAssessment,
  buildRelationshipAssessmentContextFromPacket,
  loadInstitutionalAdviceSnippets,
} from "@/lib/growth/aios/growth/growth-relationship-strategy-2a"
import type { GrowthAutonomousOutreachPreparationWakeCondition } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

export async function buildAutonomousOutreachApprovalPackage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string | null
    snapshot: GrowthLeadResearchWorkflowSnapshot
    generatedAt: string
    teammateName?: string | null
    previousPackage?: GrowthAutonomousOutreachApprovalPackage | null
    refreshReasons?: string[]
    wakeCondition?: GrowthAutonomousOutreachPreparationWakeCondition
    adaptiveEvents?: AdaptiveProspectEvent[]
  },
): Promise<GrowthAutonomousOutreachApprovalPackage> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    throw new Error("Lead not found for outreach preparation.")
  }

  const decisionMakers = await listGrowthLeadDecisionMakers(admin, input.leadId).catch(() => [])
  const primaryDm =
    decisionMakers.find((row) => row.id === lead.primaryDecisionMakerId) ?? decisionMakers[0] ?? null

  const companyName = lead.companyName ?? input.companyName ?? "this company"
  const verifiedEvidence = input.snapshot.evidenceSummary?.verifiedEvidence ?? []
  const missingEvidence = input.snapshot.evidenceSummary?.missingEvidence ?? []
  const assumptions = input.snapshot.evidenceSummary?.assumptions ?? []
  const equipmentFromLead = lead.fieldServiceStackDetected
    ? [lead.fieldServiceStackDetected]
    : []
  const equipmentFromEvidence = verifiedEvidence
    .filter((line) => /service indicator|equipment|mri|ct|imaging|fleet/i.test(line))
    .map((line) => line.replace(/^Service indicator:\s*/i, "").trim())
    .filter(Boolean)

  const confidence = resolveOutreachPreparationConfidence(input.snapshot)
  const teammate = resolveAiTeammatePresentation(input.teammateName)

  // SALES-PLAYBOOK-1B / MASTER-KNOWLEDGE-1A — Seller Truth from enriched Approved Business Profile.
  const profileRecord = await getActiveApprovedBusinessProfile(admin, input.organizationId).catch(
    () => null,
  )
  const enrichedProfile = profileRecord?.profile
    ? enrichBusinessProfileFromMasterContextDocument(profileRecord.profile, {
        ingestedAt: input.generatedAt,
      })
    : null

  const sellerTruth = await loadOutreachSellerTruthForOrganization(admin, {
    organizationId: input.organizationId,
    preparedAt: input.generatedAt,
    prospectIndustry: null,
    prospectCompanyName: companyName,
    leadId: input.leadId,
  })

  const researchRun = await fetchLatestCompletedProspectResearchRun(admin, input.leadId).catch(
    () => null,
  )
  const prospectKnowledgePack = researchRun?.signals?.prospectKnowledgePack_v25c ?? null

  let learningWeights: GrowthOutreachLearningThemeWeight[] | null = null
  try {
    const generatedMs = Date.parse(input.generatedAt)
    const dateFrom = new Date(generatedMs - 90 * 86400000).toISOString()
    const outreachSignals = await loadSequenceOptimizationOutreachSignals(admin, {
      dateFrom,
      dateTo: input.generatedAt,
      channel: null,
      repUserId: null,
      sequenceId: null,
      attributionModel: "last_touch",
    })
    learningWeights = outreachSignals.openerSignals.map((row) => ({
      themeKey: row.key,
      replyRatePct: row.replyRatePct,
      sends: row.sends,
    }))
  } catch {
    learningWeights = null
  }

  const bcRollup = await loadBuyingCommitteeIntelligenceLeadRollup(admin, input.leadId).catch(() => null)
  const bcStatus =
    bcRollup?.company_id != null
      ? await loadBuyingCommitteeIntelligenceOperatorStatus(admin, {
          company_id: bcRollup.company_id,
        }).catch(() => null)
      : null
  const buyingCommitteeSnapshot =
    bcRollup && bcStatus
      ? {
          hasVerifiedCommittee: bcStatus.has_verified_committee,
          discoveryPending: bcRollup.discovery_pending,
          discoveryFailed: bcRollup.discovery_failed,
          singleThreadRisk: bcStatus.single_thread_risk,
          coverageScore: bcStatus.coverage_score,
          rolesPresent: bcStatus.roles_present,
          rolesMissing: bcStatus.roles_missing,
          verifiedMemberCount: bcStatus.verified_member_count,
        }
      : bcRollup
        ? {
            hasVerifiedCommittee: bcRollup.has_verified_committee,
            discoveryPending: bcRollup.discovery_pending,
            discoveryFailed: bcRollup.discovery_failed,
            singleThreadRisk: true,
            coverageScore: 0,
            rolesPresent: [],
            rolesMissing: [],
            verifiedMemberCount: 0,
          }
        : null

  const communicationPlan = requestGrowthCommunicationPlan({
    organizationId: input.organizationId,
    subject: { type: "lead", id: input.leadId },
    goal: "qualify",
    context: {
      emailReady: true,
      smsReady: true,
      senderReady: true,
      engagementScore: confidence,
      metaRecommendationType:
        input.snapshot.nextBestAction?.kind === "generate_outreach_draft" &&
        /sms/i.test(input.snapshot.nextBestAction.label)
          ? "sms"
          : "email",
    },
    generatedAt: input.generatedAt,
  })
  const communicationChannelHint = resolveCommunicationPlanRecommendedChannel(communicationPlan)

  const [leadMemory, contextPacket] = await Promise.all([
    buildLeadMemoryInfluenceContext(admin, input.leadId).catch(() => null),
    buildOutreachContextPacket(admin, lead).catch(() => null),
  ])

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

  const previousRevenue = input.previousPackage?.salesStrategyBrief?.revenueStrategyIntelligence

  const adaptiveEvents =
    input.adaptiveEvents ??
    (await loadPendingAdaptiveEventsForLead(admin, input.leadId).catch(() => []))

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

  let effectiveMemory = leadMemory
  let effectiveCommittee = buyingCommitteeSnapshot
  let relationshipAssessment

  if (adaptiveEvents.length) {
    const adaptive = applyAdaptiveLoopToOutreachPreparation({
      events: adaptiveEvents,
      memory: leadMemory,
      context: relationshipContext,
      lead: leadSignals,
      committee: buyingCommitteeSnapshot,
      assessmentInput: {
        leadId: input.leadId,
        companyName,
        preparedAt: input.generatedAt,
        previousRecommendation: previousRevenue?.recommendation ?? null,
        previousConfidence: previousRevenue?.confidenceScore ?? null,
        institutionalAdvice: loadInstitutionalAdviceSnippets({
          industry: sellerTruth.industries[0] ?? null,
        }),
        committeeMemberCount: buyingCommitteeSnapshot?.verifiedMemberCount,
        singleThreadRisk: buyingCommitteeSnapshot?.singleThreadRisk,
      },
      learningWeights,
      previousAssessment: input.previousPackage?.salesStrategyBrief?.relationshipAssessment,
      previousRevenue,
      extraRefreshReasons: input.refreshReasons ?? (input.wakeCondition ? [input.wakeCondition] : []),
    })
    effectiveMemory = adaptive.memory
    effectiveCommittee = adaptive.committee
    relationshipAssessment = adaptive.relationshipAssessment
  } else {
    relationshipAssessment = buildRelationshipAssessment({
      leadId: input.leadId,
      companyName,
      preparedAt: input.generatedAt,
      memory: leadMemory,
      context: relationshipContext,
      lead: leadSignals,
      refreshReasons: input.refreshReasons ?? (input.wakeCondition ? [input.wakeCondition] : []),
      previousRecommendation: previousRevenue?.recommendation ?? null,
      previousConfidence: previousRevenue?.confidenceScore ?? null,
      institutionalAdvice: loadInstitutionalAdviceSnippets({
        industry: sellerTruth.industries[0] ?? null,
      }),
    })
  }

  // Think first — Prospect Truth + Seller Truth → Conversation Strategy → drafts.
  let salesStrategyBrief = buildOutreachSalesStrategyBrief({
    leadId: input.leadId,
    companyName,
    preparedAt: input.generatedAt,
    website: lead.website,
    contactName: primaryDm?.fullName ?? lead.contactName,
    contactTitle: primaryDm?.title ?? null,
    contactEmail: primaryDm?.email ?? lead.contactEmail,
    contactPhone: primaryDm?.phone ?? lead.contactPhone,
    location: [lead.city, lead.state, lead.country].filter(Boolean).join(", ") || null,
    employees: lead.estimatedEmployeeCount,
    revenueEstimate: lead.estimatedAnnualRevenue,
    equipmentServiced: [...equipmentFromLead, ...equipmentFromEvidence].slice(0, 4),
    verifiedEvidence,
    missingEvidence,
    assumptions,
    opportunitySummary: input.snapshot.opportunityAssessment?.summary ?? null,
    fitReason: input.snapshot.qualification?.reason ?? null,
    qualificationConfidence: input.snapshot.qualification?.confidence ?? null,
    researchConfidence: confidence,
    personalizationSignals: [],
    industry: sellerTruth.industries[0] ?? null,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    contactTemperature: lead.contactTemperature,
    leadStatus: lead.status,
    hasMeetingScheduled: Boolean(lead.followUpAt && /meeting/i.test(lead.nextBestActionReason ?? "")),
    isCustomer: /customer|won|converted/i.test(lead.status),
    sellerTruth,
    approvedProfile: enrichedProfile,
    approvedProfileId: profileRecord?.id ?? null,
    prospectKnowledgePack,
    learningWeights,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    opportunityReadinessScore: lead.opportunityReadinessScore,
    decisionMakers: decisionMakers.map((row) => ({
      name: row.fullName,
      title: row.title,
      isPrimary: row.id === lead.primaryDecisionMakerId || row.id === primaryDm?.id,
    })),
    buyingCommitteeSnapshot: effectiveCommittee,
    communicationChannelHint,
    relationshipAssessment,
    leadMemory: effectiveMemory,
    adaptiveEvents,
  })

  if (adaptiveEvents.length && salesStrategyBrief.relationshipAssessment) {
    salesStrategyBrief = {
      ...salesStrategyBrief,
      adaptiveLoopEvolution: {
        qaMarker: GROWTH_AIOS_ADAPTIVE_LOOP_1A_QA_MARKER,
        eventCount: adaptiveEvents.length,
        recentEvents: adaptiveEvents,
        strategyChange: detectAdaptiveStrategyChanges({
          previousAssessment: input.previousPackage?.salesStrategyBrief?.relationshipAssessment,
          currentAssessment: salesStrategyBrief.relationshipAssessment,
          previousRevenue: input.previousPackage?.salesStrategyBrief?.revenueStrategyIntelligence,
          currentRevenue: salesStrategyBrief.revenueStrategyIntelligence,
          events: adaptiveEvents,
        }),
        relationshipAssessment: salesStrategyBrief.relationshipAssessment,
        learningAdvisoryApplied: Boolean(learningWeights?.length),
      },
    }
    await markAdaptiveEventsProcessedForLead(admin, input.leadId, input.generatedAt).catch(
      () => undefined,
    )
  }

  const drafts = generateOutreachDraftsFromSalesStrategyBrief({
    brief: salesStrategyBrief,
    senderName: teammate.name,
  })

  const generatedAssets = mergeOperatorAssetStateFromPreviousPackage({
    generatedAssets: summarizeStrategyDerivedAssetsForPackage(drafts),
    previousPackage: input.previousPackage,
  })

  const packageId = `outreach-prep:${input.leadId}:${input.generatedAt}`

  const revenueChannel = salesStrategyBrief.revenueStrategyIntelligence
    ? mapRevenueStrategyChannelToPackage(salesStrategyBrief.revenueStrategyIntelligence.channelPlan)
    : communicationChannelHint
  const revenueSequence = salesStrategyBrief.revenueStrategyIntelligence
    ? mapRevenueStrategySequenceToPackage(salesStrategyBrief.revenueStrategyIntelligence.sequencePlan)
    : "email_first_multichannel"

  return {
    packageId,
    leadId: input.leadId,
    companyName: lead.companyName ?? input.companyName,
    preparedAt: input.generatedAt,
    generatedAssets,
    salesStrategyBrief,
    draftQuality: {
      emailWordCount: drafts.email.wordCount,
      emailReadTimeSeconds: estimateReadTimeSeconds(drafts.email.body),
      smsCharacterCount: drafts.sms.length,
      qualityFailures: [
        ...drafts.qualityFailures,
        ...(salesStrategyBrief.sellerKnowledgeQuality?.readyForDraftGeneration === false
          ? ["seller_knowledge_incomplete"]
          : []),
      ],
      sellerKnowledgeQuality: salesStrategyBrief.sellerKnowledgeQuality,
    },
    personalizationEvidence: [
      `Primary hook: ${salesStrategyBrief.primaryHook}`,
      `Conversation justification: ${salesStrategyBrief.conversationJustification}`,
      `CTA: ${salesStrategyBrief.recommendedCta}`,
      salesStrategyBrief.operatorReasoning?.conversationGoal
        ? `Conversation goal: ${salesStrategyBrief.operatorReasoning.conversationGoal}`
        : null,
      salesStrategyBrief.operatorReasoning?.businessOutcome
        ? `Business outcome: ${salesStrategyBrief.operatorReasoning.businessOutcome}`
        : null,
      `Seller source: ${sellerTruth.source}`,
      ...salesStrategyBrief.trustBuilders.slice(0, 3),
    ].filter((line): line is string => Boolean(line)),
    supportingResearch: verifiedEvidence.slice(0, 6),
    confidence: Math.max(confidence, salesStrategyBrief.confidence),
    approvalRequirements: [
      "operator_outbound_approval",
      "human_send_gate",
      "channel_prepare_review",
    ],
    complianceNotes: [
      "Draft-only — nothing sends until you authorize and clear sequence transport gates.",
      "LinkedIn and SMS remain manual send from the operator workspace.",
      "Personalized video stays draft-only until you explicitly approve recording.",
      "All channels share one sales strategy brief (Prospect Truth + Seller Truth → Conversation Strategy).",
      salesStrategyBrief.evidenceIntelligence
        ? "Evidence sanitized through Conversation Intelligence before drafts."
        : null,
      "Customer-facing drafts reviewed for elite human SDR voice (CONVERSATION-INTELLIGENCE-1B).",
      sellerTruth.source === "approved_business_profile"
        ? enrichedProfile?.masterKnowledgeIngestion?.isRuntimeSourceOfTruth === false
          ? "Seller messaging derived from enriched Approved Business Profile (Master Context ingested, not runtime SoT)."
          : "Seller messaging derived from Approved Business Profile."
        : "Seller messaging used safe defaults — Approved Business Profile not available.",
    ].filter((line): line is string => Boolean(line)),
    recommendedChannel: revenueChannel,
    recommendedSequence: revenueSequence,
    expectedOutcome:
      input.snapshot.executionPlan?.expectedOutcome ??
      salesStrategyBrief.businessObjective,
    pendingHumanApproval: true,
    transportBlocked: true,
  }
}

export const AUTONOMOUS_OUTREACH_PREPARATION_WORKFLOW =
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_ALLOWED_WORKFLOW
