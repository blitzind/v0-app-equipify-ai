/** Growth Engine S2-H — conversational qualification flow definitions (static metadata, no persistence). Client-safe. */

export const GROWTH_MEDIA_CONVERSATIONAL_QUALIFICATION_QA_MARKER =
  "growth-media-conversational-qualification-s2h-v1" as const

export type GrowthMediaConversationalBookingCriteria = {
  minimumFitScore: number
  minimumMeetingReadinessScore: number
  requiresDecisionMakerSignal: boolean
  requiresTimelineSignal: boolean
  recommendBookingWhenMet: boolean
}

export type GrowthMediaConversationalQualificationDefinition = {
  qualificationId: string
  goal: string
  questions: string[]
  requiredAnswers: string[]
  disqualifiers: string[]
  bookingCriteria: GrowthMediaConversationalBookingCriteria
}

export const GROWTH_MEDIA_CONVERSATIONAL_QUALIFICATION_CATALOG: GrowthMediaConversationalQualificationDefinition[] =
  [
    {
      qualificationId: "qual-meeting-readiness",
      goal: "meeting_readiness",
      questions: [
        "What timeline are you working toward for evaluating new solutions?",
        "Who else would be involved in a decision like this?",
        "Would a short live walkthrough be helpful this week?",
      ],
      requiredAnswers: ["timeline", "stakeholder", "interest_level"],
      disqualifiers: ["no_budget", "no_authority", "not_interested"],
      bookingCriteria: {
        minimumFitScore: 60,
        minimumMeetingReadinessScore: 70,
        requiresDecisionMakerSignal: true,
        requiresTimelineSignal: true,
        recommendBookingWhenMet: true,
      },
    },
    {
      qualificationId: "qual-fit-qualification",
      goal: "fit_qualification",
      questions: [
        "What operational challenges are you trying to solve right now?",
        "How are you handling equipment maintenance and dispatch today?",
        "Does our focus on field-service operations align with your priorities?",
      ],
      requiredAnswers: ["pain_point", "current_process", "icp_alignment"],
      disqualifiers: ["wrong_industry", "no_operational_pain", "competitor_locked"],
      bookingCriteria: {
        minimumFitScore: 70,
        minimumMeetingReadinessScore: 50,
        requiresDecisionMakerSignal: false,
        requiresTimelineSignal: false,
        recommendBookingWhenMet: false,
      },
    },
    {
      qualificationId: "qual-buying-committee",
      goal: "buying_committee_discovery",
      questions: [
        "Besides yourself, who else influences equipment or operations decisions?",
        "Is there an operations, finance, or IT stakeholder we should include?",
        "What would each stakeholder need to see before moving forward?",
      ],
      requiredAnswers: ["stakeholder_map", "committee_gap", "decision_process"],
      disqualifiers: ["single_contact_only", "unknown_decision_process"],
      bookingCriteria: {
        minimumFitScore: 55,
        minimumMeetingReadinessScore: 55,
        requiresDecisionMakerSignal: true,
        requiresTimelineSignal: false,
        recommendBookingWhenMet: true,
      },
    },
    {
      qualificationId: "qual-next-best-action",
      goal: "next_best_action",
      questions: [
        "What would be most helpful as a next step — a demo, a case study, or a follow-up call?",
        "Are there blockers we should address before scheduling time?",
        "When would be a good time to reconnect?",
      ],
      requiredAnswers: ["preferred_next_step", "blockers", "follow_up_timing"],
      disqualifiers: ["do_not_contact", "unresponsive"],
      bookingCriteria: {
        minimumFitScore: 50,
        minimumMeetingReadinessScore: 40,
        requiresDecisionMakerSignal: false,
        requiresTimelineSignal: false,
        recommendBookingWhenMet: false,
      },
    },
    {
      qualificationId: "qual-booking-recommendation",
      goal: "booking_recommendation",
      questions: [
        "Based on what you've shared, would a 20-minute working session be valuable?",
        "Who should join from your team if we schedule time?",
        "Do mornings or afternoons work better for your team?",
      ],
      requiredAnswers: ["booking_interest", "attendees", "availability_hint"],
      disqualifiers: ["declined_meeting", "insufficient_interest"],
      bookingCriteria: {
        minimumFitScore: 65,
        minimumMeetingReadinessScore: 75,
        requiresDecisionMakerSignal: true,
        requiresTimelineSignal: true,
        recommendBookingWhenMet: true,
      },
    },
  ]

export function getConversationalQualificationByGoal(
  goal: string | null | undefined,
): GrowthMediaConversationalQualificationDefinition | null {
  const trimmed = goal?.trim()
  if (!trimmed) return null
  return GROWTH_MEDIA_CONVERSATIONAL_QUALIFICATION_CATALOG.find((entry) => entry.goal === trimmed) ?? null
}

export function getConversationalQualificationById(
  qualificationId: string | null | undefined,
): GrowthMediaConversationalQualificationDefinition | null {
  const trimmed = qualificationId?.trim()
  if (!trimmed) return null
  return (
    GROWTH_MEDIA_CONVERSATIONAL_QUALIFICATION_CATALOG.find((entry) => entry.qualificationId === trimmed) ?? null
  )
}

export function validateConversationalQualificationGoal(goal: string | null | undefined): boolean {
  return getConversationalQualificationByGoal(goal) != null
}
