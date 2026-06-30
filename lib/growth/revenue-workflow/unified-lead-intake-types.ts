/** GE-LAUNCH-1A — Unified lead intake + revenue workflow types (client-safe). */

import type { AcquisitionCandidate } from "@/lib/growth/contact-verification/contact-acquisition-types"
import type { CommunicationStrategy } from "@/lib/growth/contact-verification/communication-strategy-types"
import type { NextBestAction } from "@/lib/growth/contact-verification/next-best-action-types"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { RevenueExecutionPlan } from "@/lib/growth/contact-verification/revenue-execution-plan-types"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import type { NormalizedImportRow } from "@/lib/growth/import/types"
import type { WorkQueueItem } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"

export const GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER = "unified-revenue-workflow-v1" as const

export const LEAD_INTAKE_SOURCES = [
  "apollo",
  "pdl",
  "manual",
  "csv_import",
  "datamoon",
  "linkedin_capture",
  "browser_intake",
  "saved_search",
  "website",
] as const

export type LeadIntakeSource = (typeof LEAD_INTAKE_SOURCES)[number]

export type UnifiedLeadIntakeCompanyInput = {
  name?: string | null
  website?: string | null
  domain?: string | null
  industry?: string | null
  companyId?: string | null
}

export type UnifiedLeadIntakeContactInput = {
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  personId?: string | null
  contactId?: string | null
}

export type UnifiedLeadIntakeMetadataInput = {
  leadId?: string | null
  externalRef?: string | null
  sourceUrl?: string | null
  sourcePlatform?: string | null
  captureMethod?: string | null
  identityUncertain?: boolean
  batchId?: string | null
  rowIndex?: number | null
  companyCandidateId?: string | null
  acquisitionRunId?: string | null
  [key: string]: unknown
}

export type UnifiedLeadIntakeRequest = {
  source: LeadIntakeSource | string
  company?: UnifiedLeadIntakeCompanyInput
  contact?: UnifiedLeadIntakeContactInput
  metadata?: UnifiedLeadIntakeMetadataInput
}

export type NormalizedLeadIntake = {
  qa_marker: typeof GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER
  source: LeadIntakeSource
  companyName: string
  website: string | null
  domain: string | null
  industry: string | null
  companyId: string | null
  contactName: string | null
  contactFirstName: string | null
  contactLastName: string | null
  title: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  personId: string | null
  contactId: string | null
  leadId: string | null
  externalRef: string | null
  identityUncertain: boolean
  requiresHumanReview: boolean
  warnings: string[]
  blockers: string[]
  metadata: Record<string, unknown>
  importRow: NormalizedImportRow | null
}

export type UnifiedRevenueWorkflowHumanApprovalPayload = {
  required: boolean
  reasons: string[]
  recommended_action: string | null
  recommended_channel: string | null
  guardrail_blocked: boolean
  guardrail_reasons: string[]
}

export interface UnifiedRevenueWorkflowResult {
  qa_marker: typeof GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER
  source: LeadIntakeSource
  companyId?: string
  leadId?: string
  personId?: string
  contactId?: string
  acquisitionCandidate?: AcquisitionCandidate
  qualification?: ProspectQualification
  sequenceRecommendation?: SequenceRecommendation
  nextBestAction?: NextBestAction
  revenueExecutionPlan?: RevenueExecutionPlan
  communicationStrategy?: CommunicationStrategy
  dailyWorkQueueStatus?: WorkQueueItem
  humanApproval?: UnifiedRevenueWorkflowHumanApprovalPayload
  approvalRequired: boolean
  blockers: string[]
  warnings: string[]
}
