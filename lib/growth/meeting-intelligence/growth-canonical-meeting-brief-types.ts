/**
 * GE-AIOS-MEETING-INTELLIGENCE-1A — Canonical meeting brief contract (client-safe).
 * Computed only — never persisted as a separate store.
 */

export const GROWTH_AIOS_MEETING_INTELLIGENCE_1A_QA_MARKER =
  "ge-aios-meeting-intelligence-1a-v1" as const

export type GrowthCanonicalMeetingGoal = {
  primaryObjective: string
  secondaryObjective: string | null
  relationshipObjective: string
  businessObjective: string
  successCriteria: string[]
  failureConditions: string[]
}

export type GrowthCanonicalMeetingStakeholder = {
  contactId: string | null
  name: string
  role: string | null
  influence: "high" | "medium" | "low" | "unknown"
  relationship: string | null
  likelyPriorities: string[]
  likelyConcerns: string[]
  likelyObjections: string[]
  questionsTheyShouldAnswer: string[]
  discussionLead: boolean
}

export type GrowthCanonicalMeetingAgendaStep = {
  step: string
  purpose: string
  durationHint: string | null
}

export type GrowthCanonicalMeetingObjectionPrep = {
  objection: string
  whyLikely: string
  evidence: string[]
  suggestedResponse: string
  followUpQuestion: string
  avoidSaying: string[]
}

export type GrowthCanonicalMeetingCommitmentItem = {
  commitment: string
  source: string
  status: "open" | "pending_verification" | "completed"
  dueAt: string | null
}

export type GrowthCanonicalMeetingOpportunityProgression = {
  currentStage: string
  mustHappenNext: string[]
  advanceProbability: number
  missingEvidence: string[]
  exitCriteria: string[]
}

export type GrowthCanonicalMeetingLiveSupport = {
  currentAgendaStep: string | null
  currentObjective: string | null
  pursuitOutcome: string | null
  questionToAskNext: string | null
  evidenceToReference: string[]
  risksToAvoid: string[]
  commitmentToObtain: string | null
  offTrackRecovery: string | null
  successProbability: number | null
}

export type GrowthCanonicalMeetingPostMeetingOutcomes = {
  meetingObjectiveAchieved: boolean | null
  commitmentsCompleted: boolean | null
  relationshipImproved: boolean | null
  opportunityAdvanced: boolean | null
  stakeholdersConfirmed: boolean | null
  proposalReady: boolean | null
}

export type GrowthCanonicalMeetingOperatorExperience = {
  todaysStrategy: string
  whatAvaWantsToLearn: string[]
  whatAvaWantsToLeaveWith: string[]
  risks: string[]
}

export type GrowthCanonicalMeetingBrief = {
  qaMarker: typeof GROWTH_AIOS_MEETING_INTELLIGENCE_1A_QA_MARKER
  generatedAt: string
  meetingId: string
  leadId: string
  companyName: string
  meetingObjective: string
  desiredBusinessOutcome: string
  desiredRelationshipOutcome: string
  goals: GrowthCanonicalMeetingGoal
  attendeePriorities: string[]
  stakeholders: GrowthCanonicalMeetingStakeholder[]
  missingStakeholders: string[]
  committeeGaps: string[]
  agenda: GrowthCanonicalMeetingAgendaStep[]
  recommendedDiscoveryPath: string[]
  questionsToAsk: string[]
  likelyObjections: GrowthCanonicalMeetingObjectionPrep[]
  evidenceToReference: string[]
  commitmentsToVerify: GrowthCanonicalMeetingCommitmentItem[]
  promisedFollowUps: string[]
  competitiveConsiderations: string[]
  exitCriteria: string[]
  nextMeetingRecommendation: string | null
  opportunityProgression: GrowthCanonicalMeetingOpportunityProgression
  liveSupport: GrowthCanonicalMeetingLiveSupport
  operatorExperience: GrowthCanonicalMeetingOperatorExperience
  postMeetingOutcomes: GrowthCanonicalMeetingPostMeetingOutcomes | null
  confidence: number
}

export type GrowthCanonicalMeetingIntelligenceInput = {
  opportunityProgression: GrowthCanonicalMeetingOpportunityProgression
  postMeetingOutcomes: GrowthCanonicalMeetingPostMeetingOutcomes | null
}
