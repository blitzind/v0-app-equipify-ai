/** GE-AIOS-GROWTH-5G — Meeting preparation orchestrator (server-only). Reuses meeting intelligence pipeline. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  hasRequiredContactData,
  resolveMeetingPreparationConfidence,
  summarizePreparedMeetingAssetsForPackage,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-engine"
import type { GrowthAutonomousMeetingPreparationPackage } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import { GROWTH_AUTONOMOUS_MEETING_PILOT_ALLOWED_WORKFLOW } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { AI_MEETING_PREP_SAFETY_FLAGS } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-evidence"
import {
  buildAiMeetingPrepInputHash,
  generateAiMeetingPrep,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-generator"
import type { AiMeetingPrepGeneratorInput } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"
import { generateAndPersistAiMeetingPrep } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-service"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { gatherMeetingPrepBundleForMeeting } from "@/lib/growth/meeting-intelligence/meeting-prep-context"
import { listGrowthMeetingsForLead } from "@/lib/growth/meeting-intelligence/meeting-repository"

const SYSTEM_OPERATOR_USER_ID = "growth-autonomous-meeting-pilot"

function selectPreferredMeetingForPrep(meetings: GrowthMeeting[]): GrowthMeeting | null {
  if (meetings.length === 0) return null
  const now = Date.now()
  const scheduledUpcoming = meetings.find(
    (meeting) =>
      meeting.status === "scheduled" && meeting.startAt != null && Date.parse(meeting.startAt) >= now,
  )
  if (scheduledUpcoming) return scheduledUpcoming
  const proposed = meetings.find((meeting) => meeting.status === "proposed")
  if (proposed) return proposed
  return meetings[0] ?? null
}

function buildReferenceMeetingForLead(lead: { id: string; companyName: string | null }, generatedAt: string): GrowthMeeting {
  return {
    id: `meeting-prep-ref:${lead.id}`,
    leadId: lead.id,
    ownerUserId: null,
    opportunityId: null,
    outboundReplyId: null,
    realtimeCallSessionId: null,
    title: `Meeting prep — ${lead.companyName ?? "Account"}`,
    status: "proposed",
    startAt: null,
    endAt: null,
    source: "manual",
    provider: "phone",
    calendarEventId: null,
    calendarSyncStatus: null,
    calendarSyncError: null,
    calendarSyncedAt: null,
    calendarLastSyncAt: null,
    meetingUrl: null,
    manualMeetingUrl: null,
    meetingLocationType: null,
    meetingLocationLabel: null,
    autoCreateMeetingLink: null,
    providerConnectionRequired: false,
    notes: null,
    attendeeEmails: [],
    timezone: "UTC",
    outcome: null,
    nextAction: null,
    followUpDueAt: null,
    noShowReason: null,
    scheduledAt: null,
    completedAt: null,
    canceledAt: null,
    noShowAt: null,
    outcomeRecordedAt: null,
    createdBy: SYSTEM_OPERATOR_USER_ID,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    companyName: lead.companyName,
  }
}

async function resolveMeetingPrepArtifacts(
  admin: SupabaseClient,
  input: {
    leadId: string
    generatedAt: string
  },
): Promise<{
  meetingId: string | null
  prepBundle: NonNullable<Awaited<ReturnType<typeof gatherMeetingPrepBundleForMeeting>>>
  artifacts: ReturnType<typeof generateAiMeetingPrep>
}> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    throw new Error("Lead not found for meeting preparation.")
  }

  const meetings = await listGrowthMeetingsForLead(admin, input.leadId, 20)
  const preferredMeeting = selectPreferredMeetingForPrep(meetings)
  const meetingContext = preferredMeeting ?? buildReferenceMeetingForLead(lead, input.generatedAt)
  const isPersistedMeeting = preferredMeeting != null && !meetingContext.id.startsWith("meeting-prep-ref:")

  const prepBundle = await gatherMeetingPrepBundleForMeeting(admin, meetingContext)
  if (!prepBundle) {
    throw new Error("Meeting prep bundle could not be assembled.")
  }

  const generatorInput: AiMeetingPrepGeneratorInput = {
    meeting_id: meetingContext.id,
    prep_bundle: prepBundle,
    account_playbook_context: prepBundle.accountPlaybookContext,
    decision_makers: prepBundle.decisionMakers,
    conversation_intelligence: {
      competitor_mentions: lead.conversationCompetitorMentions.map((item) => item.name),
      competitor_pressure: lead.conversationCompetitorPressure ?? null,
      momentum_summary: lead.momentumWhySummary ?? null,
    },
    opportunity_readiness: {
      tier: lead.opportunityReadinessTier ?? null,
      score: lead.score ?? null,
    },
    meeting_readiness: {
      score: prepBundle.readiness.score,
      label: prepBundle.readiness.label,
    },
  }

  let artifacts = generateAiMeetingPrep(generatorInput)

  if (isPersistedMeeting) {
    const persisted = await generateAndPersistAiMeetingPrep(admin, {
      meeting_id: meetingContext.id,
      actor_user_id: SYSTEM_OPERATOR_USER_ID,
      regenerate: false,
    })
    if (persisted.ok && persisted.artifacts) {
      artifacts = persisted.artifacts
    }
    void buildAiMeetingPrepInputHash(generatorInput)
    void AI_MEETING_PREP_SAFETY_FLAGS
  }

  return {
    meetingId: isPersistedMeeting ? meetingContext.id : null,
    prepBundle,
    artifacts,
  }
}

export async function buildAutonomousMeetingPreparationPackage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string | null
    snapshot: GrowthLeadResearchWorkflowSnapshot
    generatedAt: string
  },
): Promise<GrowthAutonomousMeetingPreparationPackage> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    throw new Error("Lead not found for meeting preparation.")
  }

  const decisionMakers = await listGrowthLeadDecisionMakers(admin, input.leadId)
  if (
    !hasRequiredContactData({
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.contactPhone,
      decisionMakerCount: decisionMakers.length,
    })
  ) {
    throw new Error("Required contact data missing for meeting preparation.")
  }

  const { meetingId, prepBundle, artifacts } = await resolveMeetingPrepArtifacts(admin, {
    leadId: input.leadId,
    generatedAt: input.generatedAt,
  })

  const confidence = resolveMeetingPreparationConfidence(input.snapshot)
  const evidence = input.snapshot.evidenceSummary?.verifiedEvidence ?? []
  const accountSummary = [
    prepBundle.companySnapshot.companyName,
    prepBundle.companySnapshot.industry,
    prepBundle.researchSummary.summary,
  ]
    .filter(Boolean)
    .join(" · ")

  const roiDiscussion =
    prepBundle.recommendedObjectives.find((item) => /roi|value|return/i.test(item.objective))?.objective ??
    artifacts.recommended_outcome

  const followUpRecommendations =
    input.snapshot.nextBestAction?.action ??
    input.snapshot.executionPlan?.nextBestAction ??
    artifacts.recommended_outcome

  const generatedAssets = summarizePreparedMeetingAssetsForPackage({
    artifacts,
    accountSummary,
    roiDiscussion,
    followUpRecommendations,
  })

  const packageId = `meeting-prep:${input.leadId}:${input.generatedAt}`

  return {
    packageId,
    leadId: input.leadId,
    meetingId,
    companyName: lead.companyName ?? input.companyName,
    preparedAt: input.generatedAt,
    generatedAssets,
    supportingResearch: evidence.slice(0, 6),
    confidence,
    readinessScore: prepBundle.readiness.score,
    approvalRequirements: ["operator_meeting_review", "human_conduct_gate", "calendar_write_blocked"],
    complianceNotes: [
      "Preparation-only — no calendar writes or booking in GE-AIOS-GROWTH-5G.",
      "Meeting Agent does not send invitations or mutate Core.",
      "Human sales rep conducts meeting after brief review.",
    ],
    recommendedAgenda: artifacts.suggested_agenda
      .slice(0, 4)
      .map((item) => `${item.segment} (${item.duration_minutes}m): ${item.objective}`)
      .join(" · "),
    expectedOutcome: artifacts.recommended_outcome,
    pendingHumanApproval: true,
    calendarBlocked: true,
    bookingBlocked: true,
  }
}

export const AUTONOMOUS_MEETING_PREPARATION_WORKFLOW = GROWTH_AUTONOMOUS_MEETING_PILOT_ALLOWED_WORKFLOW
