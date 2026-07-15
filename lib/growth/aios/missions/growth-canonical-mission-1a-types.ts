/**
 * GE-AIOS-MISSION-ORCHESTRATION-1A — Canonical account mission types (client-safe).
 * Mission is projection only — owns no durable state.
 */

import type { GrowthHumanApprovalItem } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalPrimaryAction } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import type {
  GrowthCanonicalLeadOpportunityNarrative,
  GrowthCanonicalOperatorApprovalPackagePreview,
  GrowthCanonicalOperatorApprovalSnapshot,
  GrowthCanonicalOperatorTask,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"

export const GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER =
  "ge-aios-mission-orchestration-1a-v1" as const

export const GROWTH_CANONICAL_MISSION_TYPES = [
  "research_prospect",
  "acquire_customer",
  "continue_discovery",
  "prepare_proposal",
  "negotiate",
  "await_decision",
  "onboard",
  "expand_account",
  "recover_relationship",
  "renew_contract",
] as const

export type GrowthCanonicalMissionType = (typeof GROWTH_CANONICAL_MISSION_TYPES)[number]

export const GROWTH_CANONICAL_MISSION_PHASES = [
  "research",
  "outreach",
  "meeting",
  "proposal",
  "closed_won",
] as const

export type GrowthCanonicalMissionPhase = (typeof GROWTH_CANONICAL_MISSION_PHASES)[number]

export type GrowthCanonicalMissionProgressStage = {
  phase: GrowthCanonicalMissionPhase
  label: string
  filledSegments: number
  totalSegments: number
}

export type GrowthCanonicalMissionTimelineEvent = {
  id: string
  occurredAt: string
  category:
    | "research"
    | "memory"
    | "meeting"
    | "reply"
    | "approval"
    | "call"
    | "decision"
    | "package"
    | "relationship"
  summary: string
  href?: string | null
}

export type GrowthCanonicalMissionApprovalItem = {
  itemId: string
  label: string
  status: "waiting" | "approved" | "complete"
  href: string | null
}

export type GrowthCanonicalMission = {
  qaMarker: typeof GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER
  missionId: string
  leadId: string
  organizationId: string
  companyName: string
  contactName: string | null
  missionType: GrowthCanonicalMissionType
  missionTitle: string
  missionObjective: string
  missionPhase: GrowthCanonicalMissionPhase
  currentOwner: "ava"
  humanOwner: string | null
  currentObjective: string
  currentBlocker: string | null
  nextAvaAction: string
  nextOperatorAction: string | null
  expectedOutcome: string | null
  supportingEvidence: string[]
  riskSummary: string | null
  confidenceSummary: string | null
  timelineSummary: string | null
  requiredApprovals: GrowthCanonicalMissionApprovalItem[]
  upcomingMeeting: { at: string | null; objective: string | null } | null
  openCommitments: string[]
  currentPackage: GrowthCanonicalOperatorApprovalPackagePreview | null
  currentConversation: string | null
  relationshipSummary: string | null
  progress: GrowthCanonicalMissionProgressStage[]
  activePhaseLabel: string
  priorityScore: number
  decisionFingerprint: string | null
  primaryAction: GrowthCanonicalPrimaryAction | null
  workspaceHref: string
  completedWorkHref: string
  approvalsHref: string
  callWorkspaceHref: string
  meetingHref: string | null
}

export type BuildCanonicalMissionInput = {
  organizationId: string
  leadId: string
  companyName: string
  contactName?: string | null
  humanOwnerName?: string | null
  decisionResolution?: GrowthCanonicalDecisionResolution | null
  approvalSnapshot?: GrowthCanonicalOperatorApprovalSnapshot | null
  operatorTask?: GrowthCanonicalOperatorTask | null
  opportunityNarrative?: GrowthCanonicalLeadOpportunityNarrative | null
  hacItems?: GrowthHumanApprovalItem[]
  timelineEvents?: GrowthCanonicalMissionTimelineEvent[]
  relationshipSummary?: string | null
  memorySummary?: string | null
  conversationSummary?: string | null
  packagePreview?: GrowthCanonicalOperatorApprovalPackagePreview | null
  openCommitments?: string[]
  upcomingMeeting?: { at: string | null; objective: string | null } | null
  priorityScore?: number
}

export type GrowthCanonicalActiveMissionsProjection = {
  qaMarker: typeof GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER
  missions: GrowthCanonicalMission[]
  primaryMission: GrowthCanonicalMission | null
  /** Total active missions before Home display cap */
  totalMissionCount: number
  /** Missions beyond configured Home display limit */
  overflowMissionCount: number
  displayLimit: number
}
