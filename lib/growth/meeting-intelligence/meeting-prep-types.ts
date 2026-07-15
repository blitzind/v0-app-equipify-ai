/** Meeting prep bundle types (Sprint 3.1 + M1-B account playbook). Client-safe. */

import type { ApolloAccountPlaybookCommitteeRoleCategory } from "@/lib/growth/apollo/apollo-account-playbooks-types"
import type { ApolloMeetingBridgeAttributionRecord } from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import type { GrowthVideoMeetingPrepContext } from "@/lib/growth/sequences/growth-sequence-video-intelligence-types"

export const GROWTH_MEETING_PREP_QA_MARKER = "growth-meeting-prep-v1" as const

export const MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER =
  "growth-meeting-prep-account-playbook-m1b-v1" as const

export const MEETING_PREP_RISK_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const
export type MeetingPrepRiskPriority = (typeof MEETING_PREP_RISK_PRIORITIES)[number]

export type MeetingPrepCompanySnapshot = {
  companyName: string
  website: string | null
  industry: string | null
  location: string | null
  employees: string | null
  revenue: string | null
}

export type MeetingPrepLeadScore = {
  score: number | null
  label: string | null
  explanation: string | null
  source: "lead_engine" | "lead_score" | null
}

export type MeetingPrepBuyingStage = {
  stage: string | null
  confidence: number | null
  reason: string | null
}

export type MeetingPrepDecisionMaker = {
  id: string
  name: string
  title: string | null
  confidence: number | null
  status: string
  isPrimary: boolean
}

export type MeetingPrepTerritoryContext = {
  label: string | null
  reasons: string[]
}

export type MeetingPrepOpenRisk = {
  id: string
  label: string
  priority: MeetingPrepRiskPriority
  reason: string
  source: string
}

export type MeetingPrepObjective = {
  objective: string
  reasons: string[]
  evidence: string[]
  priority: number
}

export type MeetingPrepReadiness = {
  score: number
  label: string
  summary: string
  missing: string[]
}

export type MeetingPrepResearchSummary = {
  summary: string | null
  pitchAngle: string | null
  confidence: number | null
  painSignals: string[]
  recommendedNextAction: string | null
}

export type MeetingPrepCommitteeRoleSummaryItem = {
  fullName: string
  title: string | null
  roleCategory: ApolloAccountPlaybookCommitteeRoleCategory
  recommendedMessagingTheme: string[]
  recommendedChannelMix: string[]
  contactable: boolean
}

export type MeetingPrepStakeholderFocus = {
  roleCategory: ApolloAccountPlaybookCommitteeRoleCategory
  focusAreas: string[]
  messagingThemes: string[]
  recommendedChannels: string[]
  members: Array<{ fullName: string; title: string | null }>
}

export type MeetingPrepAccountPlaybookContext = {
  qa_marker: typeof MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER
  available: boolean
  meetingCandidateId: string | null
  accountPlaybookId: string | null
  playbookKey: string | null
  committeeRoleSummary: MeetingPrepCommitteeRoleSummaryItem[]
  committeeCoverageScore: number
  committeeStrategy: string
  coverageStatus: "Weak" | "Partial" | "Strong"
  recommendedMessagingTheme: Record<string, string[]>
  recommendedChannelMix: Record<string, string[]>
  roleCategoryMix: Record<string, number>
  confidenceScore: number | null
  reasoning: string | null
  sourceAttribution: ApolloMeetingBridgeAttributionRecord | null
  stakeholderFocus: MeetingPrepStakeholderFocus[]
  accountLevelObjective: MeetingPrepObjective | null
  committeeCoverageRisks: MeetingPrepOpenRisk[]
}

export type GrowthMeetingPrepBundle = {
  qa_marker: typeof GROWTH_MEETING_PREP_QA_MARKER
  meeting: Pick<
    GrowthMeeting,
    | "id"
    | "leadId"
    | "title"
    | "status"
    | "startAt"
    | "endAt"
    | "source"
    | "calendarEventId"
    | "attendeeEmails"
    | "meetingUrl"
  >
  companySnapshot: MeetingPrepCompanySnapshot
  leadScore: MeetingPrepLeadScore
  buyingStage: MeetingPrepBuyingStage
  decisionMakers: MeetingPrepDecisionMaker[]
  contactIntelligence: GrowthProspectSearchContactIntelligence | null
  territoryContext: MeetingPrepTerritoryContext
  signals: string[]
  openRisks: MeetingPrepOpenRisk[]
  researchSummary: MeetingPrepResearchSummary
  recommendedObjectives: MeetingPrepObjective[]
  readiness: MeetingPrepReadiness
  accountPlaybookContext: MeetingPrepAccountPlaybookContext | null
  videoEngagementContext: GrowthVideoMeetingPrepContext | null
  /** GE-AIOS-DECISION-ENGINE-1B — canonical decision alignment for meeting workspace */
  canonicalDecision?: import("@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types").GrowthCanonicalDecisionResolution | null
  canonicalRecommendedNextAction?: string | null
  /** GE-AIOS-MEETING-INTELLIGENCE-1A — computed battle plan (never persisted separately) */
  canonicalMeetingBrief?: import("@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-types").GrowthCanonicalMeetingBrief | null
  /** GE-AIOS-MISSION-ORCHESTRATION-1A — mission brief for meeting workspace */
  canonicalMission?: import("@/lib/growth/aios/missions/growth-canonical-mission-1a-types").GrowthCanonicalMission | null
}
