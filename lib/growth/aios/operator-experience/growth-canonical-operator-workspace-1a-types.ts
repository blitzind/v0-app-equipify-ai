/**
 * GE-AIOS-OPERATOR-EXPERIENCE-1A — Canonical operator workspace types (client-safe).
 */

import type { GrowthHumanApprovalItem } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthCanonicalOperatorDecisionProjection } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"

export const GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER =
  "ge-aios-operator-experience-1a-v1" as const

import type { GrowthOperatorPackageReviewSource } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export type GrowthCanonicalOperatorApprovalPackagePreview = {
  itemId: string
  packageId: string
  leadId: string
  companyName: string
  decisionMaker: string | null
  draftCount: number
  preparedAt: string | null
  preparedAgoLabel: string | null
  channelLabel: string | null
  statusLabel: string
  reviewHref: string
  packageSource?: GrowthOperatorPackageReviewSource
  /** AVA-HOME-PROJECTION-CUTOVER-1A — richer operator detail for supervised drafts */
  operatorDetail?: string | null
}

export type GrowthCanonicalOperatorApprovalSnapshot = {
  qaMarker: typeof GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER
  outreachPackageCount: number
  outreachDraftCount: number
  /** Draft packages awaiting operator message approval — excludes approved-unsent send queue. */
  pendingApprovalCount: number
  /** Supervised drafts with valid binding awaiting transport send. */
  approvedReadyToSendCount?: number
  waitingForOperator: boolean
  packages: GrowthCanonicalOperatorApprovalPackagePreview[]
  topPackage: GrowthCanonicalOperatorApprovalPackagePreview | null
}

export type GrowthCanonicalOperatorTaskKind =
  | "approval"
  | "decision"
  | "reply"
  | "meeting"
  | "none"

export type GrowthCanonicalOperatorTask = {
  id: string
  kind: GrowthCanonicalOperatorTaskKind
  title: string
  detail: string
  why: string
  whatHappensNext: string
  confidenceLabel: string | null
  href: string
  companyName: string | null
  leadId: string | null
  draftCount: number
  packageCount: number
}

export type GrowthCanonicalLeadOpportunityNarrative = {
  qaMarker: typeof GROWTH_AIOS_OPERATOR_EXPERIENCE_1A_QA_MARKER
  currentFocus: string
  blockedBy: string | null
  nextStep: string
  why: string
  evidence: string[]
  progress: string | null
  approvalRequired: boolean
  nextAction: string
  waitingForOperatorSummary: string | null
  draftCount: number
  packageCount: number
  decisionFingerprint: string | null
  hacItemId: string | null
}

export type GrowthCanonicalOperatorWorkspaceLeadContext = {
  leadId: string
  companyName: string
  hacItem?: GrowthHumanApprovalItem | null
  decision?: GrowthCanonicalOperatorDecisionProjection | null
  approvalSnapshot?: GrowthCanonicalOperatorApprovalSnapshot | null
}
