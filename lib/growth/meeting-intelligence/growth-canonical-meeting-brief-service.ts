/**
 * GE-AIOS-MEETING-INTELLIGENCE-1A — Resolve canonical meeting brief (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a"
import { resolveCanonicalOutreachPackageForLead } from "@/lib/growth/aios/growth/growth-send-plane-1a-canonical-loader"
import { loadLatestStoredCallWorkspacePostCallClosureForLead } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-stored-closure"
import { resolveGrowthCanonicalDecisionForLead } from "@/lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead"
import { resolveCanonicalHumanMemoryForLead } from "@/lib/growth/lead-memory/resolve-canonical-human-memory-for-lead"
import {
  buildGrowthCanonicalMeetingBrief,
  type BuildGrowthCanonicalMeetingBriefInput,
} from "@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-builder"
import type { GrowthCanonicalMeetingBrief } from "@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-types"
import type { GrowthMeetingPrepBundle } from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"

export async function resolveGrowthCanonicalMeetingBriefForMeeting(
  admin: SupabaseClient,
  input: {
    organizationId: string
    meeting: GrowthMeeting
    prepBundle: GrowthMeetingPrepBundle
    generatedAt?: string
    agendaStepIndex?: number | null
  },
): Promise<GrowthCanonicalMeetingBrief | null> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  const [memoryBundle, outreachPackage, canonicalDecision, storedClosure] = await Promise.all([
    resolveCanonicalHumanMemoryForLead(admin, {
      organizationId: input.organizationId,
      leadId: input.meeting.leadId,
      generatedAt,
      companyName: input.prepBundle.companySnapshot.companyName,
    }).catch(() => null),
    resolveCanonicalOutreachPackageForLead(admin, {
      organizationId: input.organizationId,
      leadId: input.meeting.leadId,
    }).catch(() => null),
    resolveGrowthCanonicalDecisionForLead(admin, {
      organizationId: input.organizationId,
      leadId: input.meeting.leadId,
      generatedAt,
    }).catch(() => null),
    loadLatestStoredCallWorkspacePostCallClosureForLead(admin, {
      leadId: input.meeting.leadId,
    }).catch(() => null),
  ])

  const salesStrategyBrief = outreachPackage?.salesStrategyBrief ?? null
  const relationshipAssessment =
    salesStrategyBrief?.relationshipAssessment ??
    buildRelationshipAssessment({
      leadId: input.meeting.leadId,
      companyName: input.prepBundle.companySnapshot.companyName,
      preparedAt: generatedAt,
      memory: memoryBundle?.influence ?? null,
      context: memoryBundle?.relationshipContext ?? {
        priorTouchCount: 0,
        priorReplyCount: 0,
        priorOutboundSubjects: [],
        objectionSummaries: [],
        priorReplySummaries: [],
        sequenceHistorySummaries: [],
        memoryOpenLoopSummaries: [],
      },
      lead: {
        relationshipStrengthTier: null,
        leadStatus: null,
        hasMeetingScheduled: input.meeting.status === "scheduled" || input.meeting.status === "proposed",
        isCustomer: false,
        isSuppressed: false,
      },
      refreshReasons: [],
      previousRecommendation: null,
      institutionalAdvice: memoryBundle?.institutionalAdvice ?? [],
    })

  const builderInput: BuildGrowthCanonicalMeetingBriefInput = {
    generatedAt,
    prepBundle: {
      ...input.prepBundle,
      canonicalDecision: canonicalDecision ?? input.prepBundle.canonicalDecision ?? null,
    },
    salesStrategyBrief,
    leadMemory: memoryBundle?.influence ?? null,
    relationshipAssessment,
    canonicalDecision: canonicalDecision ?? input.prepBundle.canonicalDecision ?? null,
    postCallClosure: storedClosure?.closure ?? null,
    agendaStepIndex: input.agendaStepIndex,
  }

  return buildGrowthCanonicalMeetingBrief(builderInput)
}
