/**
 * GE-IRE-6G — Build sanitized Account Outreach Strategy panel view from recommendation output.
 */

import {
  recommendAccountOutreach,
  type AccountOutreachRecommendationDependencies,
  type AccountOutreachRecommendationInput,
  type AccountOutreachRecommendationResult,
} from "@/lib/growth/contact-verification/account-outreach-recommendation"
import {
  GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER,
  isAccountOutreachStrategyPanelEnabled,
} from "@/lib/growth/contact-verification/account-outreach-strategy-panel-feature"
import type {
  AccountOutreachStrategyPanelView,
} from "@/lib/growth/contact-verification/account-outreach-strategy-panel-types"
import { maskEmailForPreview } from "@/lib/growth/contact-verification/contact-engagement-prediction"

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const LINKEDIN_URL_PATTERN = /linkedin\.com/i
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/

export type AccountOutreachStrategyPanelBuildInput = AccountOutreachRecommendationInput & {
  visibleEmails?: string[]
}

function normalizeVisibleEmails(emails: string[] | undefined): Set<string> {
  return new Set(
    (emails ?? [])
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

function formatEmailForPanel(
  email: string | null | undefined,
  visibleEmails: Set<string>,
): { value: string | null; present: boolean } {
  const trimmed = email?.trim()
  if (!trimmed) return { value: null, present: false }
  if (visibleEmails.has(trimmed.toLowerCase())) {
    return { value: trimmed, present: true }
  }
  return { value: maskEmailForPreview(trimmed), present: true }
}

function sanitizePanelString(value: string): string {
  let sanitized = value
  sanitized = sanitized.replace(PLAINTEXT_EMAIL_PATTERN, "[redacted_email]")
  sanitized = sanitized.replace(LINKEDIN_URL_PATTERN, "[redacted_linkedin]")
  sanitized = sanitized.replace(PHONE_PATTERN, "[redacted_phone]")
  return sanitized
}

export function sanitizeAccountOutreachStrategyPanelView(
  result: AccountOutreachRecommendationResult,
  options: { visibleEmails?: string[] } = {},
): AccountOutreachStrategyPanelView {
  const visibleEmails = normalizeVisibleEmails(options.visibleEmails)

  const primaryEmail = result.primary_recommendation
    ? formatEmailForPanel(
        result.primary_recommendation.recommended_email ??
          result.primary_recommendation.contact.contact.email,
        visibleEmails,
      )
    : { value: null, present: false }

  return {
    qa_marker: GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER,
    company_name: result.companyName,
    domain: result.domain,
    primary: result.primary_recommendation
      ? {
          display_name: result.primary_recommendation.contact.contact.display_name,
          committee_role: result.primary_recommendation.committee_role,
          recommended_channel: result.primary_recommendation.recommended_channel,
          score: result.primary_recommendation.score,
          confidence: result.primary_recommendation.confidence,
          recommended_email: primaryEmail.value,
          recommended_email_present: primaryEmail.present,
          reasons: result.primary_recommendation.reasons.map(sanitizePanelString),
          evidence: result.primary_recommendation.evidence.map(sanitizePanelString),
          warnings: result.primary_recommendation.warnings.map(sanitizePanelString),
        }
      : undefined,
    backups: result.backup_recommendations.map((backup) => ({
      display_name: backup.contact.contact.display_name,
      committee_role: backup.committee_role,
      recommended_channel: backup.recommended_channel,
      score: backup.score,
      reasons: backup.reasons.map(sanitizePanelString),
    })),
    committee: {
      coverage_score: Math.round(result.summary.committee_coverage_score * 100),
      coverage_tier: result.committee.coverage.coverage_tier,
      covered_roles: result.committee.coverage.covered_roles,
      missing_roles: result.committee.coverage.missing_roles,
      recommended_strategy: sanitizePanelString(result.summary.recommended_strategy),
    },
    staged_plan: result.staged_plan.map((step) => ({
      step: step.step,
      action: step.action,
      contact_name: step.contact_name,
      committee_role: step.committee_role,
      channel: step.channel,
      rationale: sanitizePanelString(step.rationale),
    })),
    readiness: {
      ready: result.readiness.ready,
      score: result.readiness.score,
      tier: result.readiness.tier,
      blockers: result.readiness.blockers.map(sanitizePanelString),
    },
    summary: {
      total_contacts: result.summary.total_contacts,
      recommended_contacts: result.summary.recommended_contacts,
      primary_contact: result.summary.primary_contact,
      recommended_strategy: sanitizePanelString(result.summary.recommended_strategy),
    },
    warnings: result.warnings.map(sanitizePanelString),
  }
}

export async function buildAccountOutreachStrategyPanelView(
  input: AccountOutreachStrategyPanelBuildInput,
  dependencies: AccountOutreachRecommendationDependencies = {},
): Promise<AccountOutreachStrategyPanelView | null> {
  if (!isAccountOutreachStrategyPanelEnabled()) return null
  if (!input.contacts.length) return null

  const { visibleEmails, ...recommendationInput } = input
  const result = await recommendAccountOutreach(recommendationInput, { skipDns: true, ...dependencies })
  return sanitizeAccountOutreachStrategyPanelView(result, { visibleEmails })
}

export function assertAccountOutreachStrategyPanelViewHasNoSensitiveData(
  output: unknown,
  options: { allowEmails?: string[] } = {},
): boolean {
  const text = JSON.stringify(output)
  const allowed = new Set((options.allowEmails ?? []).map((email) => email.trim().toLowerCase()))

  const emails = text.match(new RegExp(PLAINTEXT_EMAIL_PATTERN.source, "gi")) ?? []
  for (const email of emails) {
    if (!allowed.has(email.toLowerCase())) return false
  }

  if (LINKEDIN_URL_PATTERN.test(text)) return false
  if (PHONE_PATTERN.test(text)) return false
  return true
}
