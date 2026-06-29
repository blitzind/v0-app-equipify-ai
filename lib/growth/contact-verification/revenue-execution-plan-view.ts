/**
 * GE-IRE-8B — Sanitized Revenue Execution Plan view model for UI/API.
 */

import {
  buildRevenueExecutionPlan,
  type RevenueExecutionPlanEngineDependencies,
  type RevenueExecutionPlanEngineInput,
} from "@/lib/growth/contact-verification/revenue-execution-planner"
import {
  GROWTH_REVENUE_EXECUTION_PLAN_PANEL_QA_MARKER,
  isRevenueExecutionPlanEnabled,
} from "@/lib/growth/contact-verification/revenue-execution-plan-feature"
import type { RevenueExecutionPlan } from "@/lib/growth/contact-verification/revenue-execution-plan-types"
import { mapProspectSearchIntelligenceToNextBestActionInput } from "@/lib/growth/contact-verification/next-best-action-view"
import type { NextBestAction } from "@/lib/growth/contact-verification/next-best-action-types"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const LINKEDIN_URL_PATTERN = /linkedin\.com/i
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/

export type RevenueExecutionPlanStepView = {
  order: number
  label: string
  description: string
  status: string
  estimated_minutes: number
}

export type RevenueExecutionPlanView = {
  qa_marker: typeof GROWTH_REVENUE_EXECUTION_PLAN_PANEL_QA_MARKER
  company_id: string
  generated_at: string
  execution_state: string
  execution_mode: string
  recommended_workflow: string
  execution_steps: RevenueExecutionPlanStepView[]
  prerequisites: string[]
  approvals_required: string[]
  estimated_duration_minutes: number
  estimated_duration_label: string
  confidence: number
  risks: string[]
  blockers: string[]
}

export type RevenueExecutionPlanApiResponse = {
  ok: boolean
  enabled: boolean
  view?: RevenueExecutionPlanView
  message?: string
}

export type RevenueExecutionPlanViewBuildInput = RevenueExecutionPlanEngineInput

function sanitizeViewString(value: string): string {
  let sanitized = value
  sanitized = sanitized.replace(PLAINTEXT_EMAIL_PATTERN, "[redacted_email]")
  sanitized = sanitized.replace(LINKEDIN_URL_PATTERN, "[redacted_linkedin]")
  sanitized = sanitized.replace(PHONE_PATTERN, "[redacted_phone]")
  return sanitized
}

export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `${hours} hour${hours === 1 ? "" : "s"}`
  return `${hours}h ${remainder}m`
}

export function sanitizeRevenueExecutionPlanView(plan: RevenueExecutionPlan): RevenueExecutionPlanView {
  return {
    qa_marker: GROWTH_REVENUE_EXECUTION_PLAN_PANEL_QA_MARKER,
    company_id: plan.companyId,
    generated_at: plan.generatedAt,
    execution_state: plan.executionState,
    execution_mode: plan.executionMode,
    recommended_workflow: plan.recommendedWorkflow,
    execution_steps: plan.executionSteps.map((step) => ({
      order: step.order,
      label: sanitizeViewString(step.label),
      description: sanitizeViewString(step.description),
      status: step.status,
      estimated_minutes: step.estimatedMinutes,
    })),
    prerequisites: plan.prerequisites.map(sanitizeViewString),
    approvals_required: plan.approvalsRequired.map(sanitizeViewString),
    estimated_duration_minutes: plan.estimatedDurationMinutes,
    estimated_duration_label: formatDurationLabel(plan.estimatedDurationMinutes),
    confidence: plan.confidence,
    risks: plan.risks.map(sanitizeViewString),
    blockers: plan.blockers.map(sanitizeViewString),
  }
}

export async function buildRevenueExecutionPlanView(
  input: RevenueExecutionPlanViewBuildInput,
  dependencies: RevenueExecutionPlanEngineDependencies = {},
): Promise<RevenueExecutionPlanView | null> {
  if (!isRevenueExecutionPlanEnabled()) return null

  const hasNextBestAction = Boolean(input.nextBestAction)
  const hasQualification = Boolean(input.qualification)
  const hasQualificationInput =
    Boolean(input.qualificationInput?.acquisitionCandidate) ||
    Boolean(input.qualificationInput?.acquisitionInput?.contacts.length)

  if (!hasNextBestAction && !hasQualification && !hasQualificationInput) return null

  const plan = await buildRevenueExecutionPlan(input, { skipDns: true, ...dependencies })
  return sanitizeRevenueExecutionPlanView(plan)
}

export function mapProspectSearchIntelligenceToExecutionPlanInput(input: {
  companyId: string
  companyName?: string | null
  website?: string | null
  industry?: string | null
  companyMatchConfidence?: number | null
  isSuppressed?: boolean
  suppressionReason?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
  nextBestAction?: NextBestAction
  qualification?: ProspectQualification
  sequenceRecommendation?: SequenceRecommendation
}): RevenueExecutionPlanEngineInput | null {
  if (input.nextBestAction || input.qualification || input.sequenceRecommendation) {
    return {
      companyId: input.companyId,
      nextBestAction: input.nextBestAction,
      qualification: input.qualification,
      sequenceRecommendation: input.sequenceRecommendation,
    }
  }

  const mapped = mapProspectSearchIntelligenceToNextBestActionInput({
    companyId: input.companyId,
    companyName: input.companyName,
    website: input.website,
    industry: input.industry,
    companyMatchConfidence: input.companyMatchConfidence,
    isSuppressed: input.isSuppressed,
    suppressionReason: input.suppressionReason,
    intelligence: input.intelligence,
  })
  if (!mapped) return null

  return {
    companyId: input.companyId,
    qualificationInput: mapped.qualificationInput,
  }
}

export function assertRevenueExecutionPlanViewHasNoSensitiveData(output: unknown): boolean {
  const payload =
    output && typeof output === "object"
      ? { ...(output as Record<string, unknown>), generated_at: "[redacted_timestamp]" }
      : output
  const text = JSON.stringify(payload)

  if (PLAINTEXT_EMAIL_PATTERN.test(text)) return false
  if (LINKEDIN_URL_PATTERN.test(text)) return false
  if (PHONE_PATTERN.test(text)) return false
  if (text.includes("acquisitionCandidate")) return false
  if (/"qualification"\s*:/.test(text)) return false
  if (/"sequenceRecommendation"\s*:/.test(text)) return false
  if (/"nextBestAction"\s*:/.test(text)) return false
  return true
}
