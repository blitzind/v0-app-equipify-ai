/**
 * GE-IRE-6F — Account Outreach Strategy shadow diagnostics.
 * Read-only strategy intelligence. Logging only when flag enabled. No runtime influence.
 */

import {
  recommendAccountOutreach,
  type AccountOutreachRecommendationDependencies,
  type AccountOutreachRecommendationInput,
  type AccountOutreachRecommendationResult,
} from "@/lib/growth/contact-verification/account-outreach-recommendation"
import type { ContactRecommendationCandidateInput } from "@/lib/growth/contact-verification/contact-recommendation-engine"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

export const GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW_QA_MARKER =
  "account-outreach-strategy-shadow-v1" as const

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const LINKEDIN_URL_PATTERN = /linkedin\.com/i
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/

export type AccountOutreachStrategyShadowInput = AccountOutreachRecommendationInput & {
  context?: Record<string, unknown>
}

export type AccountOutreachStrategyShadowLogEntry = {
  qa_marker: typeof GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW_QA_MARKER
  shadow: "account_outreach_strategy"
  company_present: boolean
  domain_present: boolean
  total_contacts: number
  primary_contact_present: boolean
  primary_role?: string
  recommended_channel?: string
  readiness_tier: string
  readiness_score: number
  committee_coverage_score: number
  backup_count: number
  staged_plan_steps: number
  warnings: string[]
  context?: Record<string, unknown>
}

export type AccountOutreachStrategyShadowDependencies = AccountOutreachRecommendationDependencies & {
  recommendAccountOutreach?: typeof recommendAccountOutreach
}

export function isAccountOutreachStrategyShadowEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW === "true"
}

function domainFromWebsite(website: string | null | undefined): string | undefined {
  if (!website?.trim()) return undefined
  try {
    const url = website.startsWith("http") ? new URL(website) : new URL(`https://${website}`)
    return url.hostname.replace(/^www\./, "")
  } catch {
    const stripped = website.replace(/^https?:\/\//, "").split("/")[0]?.trim()
    return stripped || undefined
  }
}

function splitDisplayName(name: string | null | undefined): {
  firstName?: string
  lastName?: string
  fullName?: string
} {
  const trimmed = name?.trim()
  if (!trimmed) return {}
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { fullName: trimmed }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    fullName: trimmed,
  }
}

function sanitizeShadowString(value: string): string {
  let sanitized = value
  sanitized = sanitized.replace(PLAINTEXT_EMAIL_PATTERN, "[redacted_email]")
  sanitized = sanitized.replace(LINKEDIN_URL_PATTERN, "[redacted_linkedin]")
  sanitized = sanitized.replace(PHONE_PATTERN, "[redacted_phone]")
  return sanitized
}

function sanitizeShadowContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!context) return undefined
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string") {
      if (PLAINTEXT_EMAIL_PATTERN.test(value)) continue
      if (LINKEDIN_URL_PATTERN.test(value)) continue
      if (PHONE_PATTERN.test(value)) continue
      sanitized[key] = value
      continue
    }
    sanitized[key] = value
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

export function mapProspectSearchContactIntelligenceToShadowInput(input: {
  companyName?: string | null
  website?: string | null
  industry?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
  context?: Record<string, unknown>
}): AccountOutreachStrategyShadowInput | null {
  if (!input.intelligence.has_contacts || input.intelligence.contacts.length === 0) {
    return null
  }

  const contacts: ContactRecommendationCandidateInput[] = input.intelligence.contacts
    .map((contact) => {
      const nameParts = splitDisplayName(contact.name)
      return {
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        fullName: nameParts.fullName,
        email: contact.email ?? undefined,
        jobTitle: contact.title ?? undefined,
        phone: contact.phone ?? undefined,
        linkedinUrl: contact.linkedin_url ?? undefined,
        confidence: contact.confidence,
        source: contact.source_label ?? undefined,
      }
    })
    .filter(
      (contact) =>
        Boolean(contact.fullName?.trim()) ||
        Boolean(contact.email?.trim()) ||
        Boolean(contact.phone?.trim()) ||
        Boolean(contact.linkedinUrl?.trim()),
    )

  if (contacts.length === 0) return null

  return {
    companyName: input.companyName?.trim() || undefined,
    domain: domainFromWebsite(input.website),
    industry: input.industry?.trim() || undefined,
    targetUseCase: "generic",
    contacts,
    context: input.context,
  }
}

export function sanitizeAccountOutreachStrategyPreview(
  result: AccountOutreachRecommendationResult,
  context?: Record<string, unknown>,
): AccountOutreachStrategyShadowLogEntry {
  const coverageScore = Math.round(result.summary.committee_coverage_score * 100)

  return {
    qa_marker: GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW_QA_MARKER,
    shadow: "account_outreach_strategy",
    company_present: Boolean(result.companyName?.trim()),
    domain_present: Boolean(result.domain?.trim()),
    total_contacts: result.summary.total_contacts,
    primary_contact_present: Boolean(result.primary_recommendation),
    primary_role: result.primary_recommendation?.committee_role,
    recommended_channel: result.primary_recommendation?.recommended_channel,
    readiness_tier: result.readiness.tier,
    readiness_score: result.readiness.score,
    committee_coverage_score: coverageScore,
    backup_count: result.backup_recommendations.length,
    staged_plan_steps: result.staged_plan.length,
    warnings: result.warnings.map((warning) => sanitizeShadowString(warning)),
    context: sanitizeShadowContext(context),
  }
}

export async function buildAccountOutreachStrategyShadow(
  input: AccountOutreachStrategyShadowInput,
  dependencies: AccountOutreachStrategyShadowDependencies = {},
): Promise<AccountOutreachStrategyShadowLogEntry | null> {
  if (!input.contacts.length) return null

  const recommend = dependencies.recommendAccountOutreach ?? recommendAccountOutreach
  const { context, ...recommendationInput } = input
  const result = await recommend(recommendationInput, { skipDns: true, ...dependencies })
  return sanitizeAccountOutreachStrategyPreview(result, context)
}

export function logAccountOutreachStrategyShadow(
  entry: AccountOutreachStrategyShadowLogEntry,
): void {
  console.info(JSON.stringify(entry))
}

export async function runAccountOutreachStrategyShadow(
  input: AccountOutreachStrategyShadowInput,
  dependencies: AccountOutreachStrategyShadowDependencies = {},
): Promise<AccountOutreachStrategyShadowLogEntry | null> {
  if (!isAccountOutreachStrategyShadowEnabled()) return null
  try {
    const entry = await buildAccountOutreachStrategyShadow(input, dependencies)
    if (entry) logAccountOutreachStrategyShadow(entry)
    return entry
  } catch (error) {
    console.warn(
      JSON.stringify({
        qa_marker: GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW_QA_MARKER,
        shadow: "account_outreach_strategy_error",
        message: error instanceof Error ? error.message : "unknown",
        context: sanitizeShadowContext(input.context),
      }),
    )
    return null
  }
}

export function shadowLogAccountOutreachStrategyFromProspectSearch(input: {
  companyName?: string | null
  website?: string | null
  industry?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
  context?: Record<string, unknown>
}): void {
  if (!isAccountOutreachStrategyShadowEnabled()) return

  const shadowInput = mapProspectSearchContactIntelligenceToShadowInput(input)
  if (!shadowInput) return

  void runAccountOutreachStrategyShadow(shadowInput).catch(() => {
    // runAccountOutreachStrategyShadow already logs errors
  })
}

export function assertAccountOutreachStrategyShadowLogHasNoSensitiveData(
  output: unknown,
): boolean {
  const text = JSON.stringify(output)
  if (PLAINTEXT_EMAIL_PATTERN.test(text)) return false
  if (LINKEDIN_URL_PATTERN.test(text)) return false
  if (PHONE_PATTERN.test(text)) return false
  return true
}
