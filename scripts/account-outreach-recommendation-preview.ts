/**
 * GE-IRE-6E — offline Account Outreach Recommendation preview CLI.
 *
 * Fixture mode (CI-safe):
 *   pnpm test:growth-account-outreach-recommendation-preview
 *
 * File input:
 *   pnpm growth:account-outreach-recommendation-preview -- --input=./account.json
 */

import fs from "node:fs"
import path from "node:path"
import {
  recommendAccountOutreach,
  type AccountOutreachRecommendationInput,
  type AccountOutreachRecommendationResult,
} from "../lib/growth/contact-verification/account-outreach-recommendation"
import {
  assertContactEngagementPreviewHasNoPlaintextEmails,
  sanitizePreviewValue,
} from "../lib/growth/contact-verification/contact-engagement-prediction"
import { buildEmailLearningObservation } from "../lib/growth/contact-verification/email-learning"
import { buildCompanyPatternEvidenceFromCounts } from "../lib/growth/contact-verification/identity-resolution-engine"
import type { EmailLearningObservation } from "../lib/growth/contact-verification/email-learning"
import {
  buildAccountOutreachStrategyShadow,
  GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW_QA_MARKER,
  type AccountOutreachStrategyShadowLogEntry,
} from "../lib/growth/contact-verification/account-outreach-strategy-shadow"

export const GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_PREVIEW_QA_MARKER =
  "growth-account-outreach-recommendation-preview-v1" as const

export type AccountOutreachPreviewInput = AccountOutreachRecommendationInput & {
  contacts: Array<Record<string, unknown>>
  historicalLearning?: EmailLearningObservation[] | Array<Record<string, unknown>>
}

export type AccountOutreachPreviewOutput = {
  qa_marker: typeof GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_PREVIEW_QA_MARKER
  companyName?: string
  domain?: string
  summary: AccountOutreachRecommendationResult["summary"] & {
    readiness_tier: string
    readiness_score: number
  }
  primary_recommendation?: {
    display_name: string
    committee_role?: string
    recommended_channel: string
    score: number
    confidence: number
    recommended_email_present: boolean
    recommended_email_masked?: string | null
    reasons: string[]
    warnings: string[]
  }
  backup_recommendations: Array<{
    display_name: string
    committee_role?: string
    recommended_channel: string
    score: number
    reasons: string[]
  }>
  committee: {
    coverage: AccountOutreachRecommendationResult["committee"]["coverage"]
    recommendation: {
      primary_contact?: string
      primary_role?: string
      recommended_strategy: string
      reasons: string[]
      warnings: string[]
    }
    summary: AccountOutreachRecommendationResult["committee"]["summary"]
  }
  staged_plan: AccountOutreachRecommendationResult["staged_plan"]
  readiness: AccountOutreachRecommendationResult["readiness"]
  warnings: string[]
}

export function buildAccountOutreachPreviewFixtures(): AccountOutreachPreviewInput {
  const historicalLearning = [
    buildEmailLearningObservation({
      email: "chris.taylor@precisionbiomedical.com",
      outcome: "sent",
      source: "outbound_send",
      eventTimestamp: "2026-06-01T10:00:00.000Z",
    }).observation!,
    buildEmailLearningObservation({
      email: "chris.taylor@precisionbiomedical.com",
      outcome: "positive_reply",
      source: "reply_intelligence",
      eventTimestamp: "2026-06-02T14:00:00.000Z",
    }).observation!,
    buildEmailLearningObservation({
      email: "john.smith@precisionbiomedical.com",
      outcome: "sent",
      source: "outbound_send",
      eventTimestamp: "2026-06-03T10:00:00.000Z",
    }).observation!,
    buildEmailLearningObservation({
      email: "pat.reed@precisionbiomedical.com",
      outcome: "meeting_booked",
      source: "meeting_booked",
      eventTimestamp: "2026-06-04T09:00:00.000Z",
    }).observation!,
  ]

  return {
    companyName: "Precision Biomedical",
    domain: "precisionbiomedical.com",
    industry: "healthcare",
    targetUseCase: "equipify_core",
    contacts: [
      {
        firstName: "Chris",
        lastName: "Taylor",
        jobTitle: "VP Operations",
        department: "operations",
        email: "chris.taylor@precisionbiomedical.com",
        phone: "+1-555-0100",
      },
      {
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Director of Operations",
        department: "operations",
        linkedinUrl: "https://linkedin.com/in/johnsmith",
      },
      {
        firstName: "Pat",
        lastName: "Reed",
        jobTitle: "Procurement Manager",
        department: "procurement",
        email: "pat.reed@precisionbiomedical.com",
      },
    ],
    historicalLearning,
  }
}

function normalizeHistoricalLearning(
  raw: EmailLearningObservation[] | Array<Record<string, unknown>> | undefined,
): EmailLearningObservation[] {
  if (!raw?.length) return []

  const normalized: EmailLearningObservation[] = []
  for (const row of raw) {
    if (row && typeof row === "object" && "qa_marker" in row && "event_type" in row) {
      normalized.push(row as EmailLearningObservation)
      continue
    }

    const record = row as Record<string, unknown>
    const built = buildEmailLearningObservation({
      email: typeof record.email === "string" ? record.email : undefined,
      outcome: typeof record.outcome === "string" ? record.outcome : "sent",
      source: typeof record.source === "string" ? record.source : "outbound_send",
      eventTimestamp:
        typeof record.eventTimestamp === "string"
          ? record.eventTimestamp
          : typeof record.event_timestamp === "string"
            ? record.event_timestamp
            : "2026-06-01T12:00:00.000Z",
      firstName: typeof record.firstName === "string" ? record.firstName : undefined,
      lastName: typeof record.lastName === "string" ? record.lastName : undefined,
    })
    if (built.observation) normalized.push(built.observation)
  }

  return normalized
}

function normalizeContacts(
  contacts: Array<Record<string, unknown>>,
): AccountOutreachRecommendationInput["contacts"] {
  return contacts.map((contact) => ({
    firstName: typeof contact.firstName === "string" ? contact.firstName : undefined,
    lastName: typeof contact.lastName === "string" ? contact.lastName : undefined,
    fullName: typeof contact.fullName === "string" ? contact.fullName : undefined,
    email: typeof contact.email === "string" ? contact.email : undefined,
    jobTitle: typeof contact.jobTitle === "string" ? contact.jobTitle : undefined,
    department: typeof contact.department === "string" ? contact.department : undefined,
    seniority: typeof contact.seniority === "string" ? contact.seniority : undefined,
    linkedinUrl: typeof contact.linkedinUrl === "string" ? contact.linkedinUrl : undefined,
    phone: typeof contact.phone === "string" ? contact.phone : undefined,
    source: typeof contact.source === "string" ? contact.source : undefined,
    confidence: typeof contact.confidence === "number" ? contact.confidence : undefined,
  }))
}

export function parseAccountOutreachPreviewInput(raw: unknown): {
  input: AccountOutreachPreviewInput | null
  warnings: string[]
} {
  const warnings: string[] = []
  if (!raw || typeof raw !== "object") {
    return { input: null, warnings: ["preview_input_invalid"] }
  }

  const record = raw as Record<string, unknown>
  if (!Array.isArray(record.contacts)) {
    return { input: null, warnings: ["preview_contacts_missing"] }
  }

  const preferences =
    record.preferences && typeof record.preferences === "object"
      ? (record.preferences as AccountOutreachPreviewInput["preferences"])
      : undefined

  return {
    input: {
      companyName: typeof record.companyName === "string" ? record.companyName : undefined,
      domain: typeof record.domain === "string" ? record.domain : undefined,
      industry: typeof record.industry === "string" ? record.industry : undefined,
      targetUseCase:
        record.targetUseCase === "growth_engine" ||
        record.targetUseCase === "equipify_core" ||
        record.targetUseCase === "service_operations" ||
        record.targetUseCase === "generic"
          ? record.targetUseCase
          : undefined,
      contacts: record.contacts as Array<Record<string, unknown>>,
      historicalLearning: normalizeHistoricalLearning(
        record.historicalLearning as EmailLearningObservation[] | Array<Record<string, unknown>> | undefined,
      ),
      preferences,
    },
    warnings,
  }
}

export function loadAccountOutreachPreviewInput(filePath: string): {
  input: AccountOutreachPreviewInput | null
  warnings: string[]
} {
  if (!filePath.trim()) {
    return { input: null, warnings: ["preview_input_path_missing"] }
  }

  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    return { input: null, warnings: [`preview_input_not_found:${path.basename(resolved)}`] }
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown
    return parseAccountOutreachPreviewInput(parsed)
  } catch (error) {
    return {
      input: null,
      warnings: [`preview_input_read_failed:${error instanceof Error ? error.message : "unknown"}`],
    }
  }
}

export async function buildAccountOutreachPreviewOutput(
  previewInput: AccountOutreachPreviewInput,
): Promise<AccountOutreachPreviewOutput> {
  const historicalLearning = normalizeHistoricalLearning(previewInput.historicalLearning)
  const companyPatternEvidence = previewInput.domain
    ? buildCompanyPatternEvidenceFromCounts({
        domain: previewInput.domain,
        pattern_counts: { first_dot_last: 25, first_initial_last: 3 },
      })
    : null

  const contacts = normalizeContacts(previewInput.contacts)

  const result = await recommendAccountOutreach(
    {
      companyName: previewInput.companyName,
      domain: previewInput.domain,
      industry: previewInput.industry,
      targetUseCase: previewInput.targetUseCase,
      contacts,
      historicalLearning,
      companyPatternEvidence,
      preferences: previewInput.preferences,
    },
    { skipDns: true },
  )

  return {
    qa_marker: GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_PREVIEW_QA_MARKER,
    companyName: result.companyName,
    domain: result.domain,
    summary: {
      ...result.summary,
      readiness_tier: result.readiness.tier,
      readiness_score: result.readiness.score,
    },
    primary_recommendation: result.primary_recommendation
      ? {
          display_name: result.primary_recommendation.contact.contact.display_name,
          committee_role: result.primary_recommendation.committee_role,
          recommended_channel: result.primary_recommendation.recommended_channel,
          score: result.primary_recommendation.score,
          confidence: result.primary_recommendation.confidence,
          recommended_email_present: Boolean(result.primary_recommendation.recommended_email),
          recommended_email_masked: result.primary_recommendation.recommended_email
            ? "***@***"
            : null,
          reasons: result.primary_recommendation.reasons,
          warnings: result.primary_recommendation.warnings,
        }
      : undefined,
    backup_recommendations: result.backup_recommendations.map((backup) => ({
      display_name: backup.contact.contact.display_name,
      committee_role: backup.committee_role,
      recommended_channel: backup.recommended_channel,
      score: backup.score,
      reasons: backup.reasons,
    })),
    committee: {
      coverage: result.committee.coverage,
      recommendation: {
        primary_contact: result.committee.recommendation.primary_contact?.contact.display_name,
        primary_role: result.committee.recommendation.primary_role,
        recommended_strategy: result.committee.recommendation.recommended_strategy,
        reasons: result.committee.recommendation.reasons,
        warnings: result.committee.recommendation.warnings,
      },
      summary: result.committee.summary,
    },
    staged_plan: result.staged_plan,
    readiness: result.readiness,
    warnings: result.warnings,
  }
}

export async function buildAccountOutreachPreviewShadowLog(
  previewInput: AccountOutreachPreviewInput,
): Promise<AccountOutreachStrategyShadowLogEntry | null> {
  const historicalLearning = normalizeHistoricalLearning(previewInput.historicalLearning)
  const contacts = normalizeContacts(previewInput.contacts)

  return buildAccountOutreachStrategyShadow(
    {
      companyName: previewInput.companyName,
      domain: previewInput.domain,
      industry: previewInput.industry,
      targetUseCase: previewInput.targetUseCase,
      contacts,
      historicalLearning,
      preferences: previewInput.preferences,
      context: { surface: "account_outreach_recommendation_preview" },
    },
    { skipDns: true },
  )
}

export async function runAccountOutreachPreview(argv: string[]): Promise<AccountOutreachPreviewOutput> {
  let fixture = false
  let inputPath: string | null = null

  for (const arg of argv) {
    if (arg === "--fixture") fixture = true
    if (arg.startsWith("--input=")) inputPath = arg.slice("--input=".length).trim() || null
  }

  if (fixture) {
    return buildAccountOutreachPreviewOutput(buildAccountOutreachPreviewFixtures())
  }

  if (inputPath) {
    const loaded = loadAccountOutreachPreviewInput(inputPath)
    if (!loaded.input) {
      return {
        qa_marker: GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_PREVIEW_QA_MARKER,
        summary: {
          total_contacts: 0,
          recommended_contacts: 0,
          committee_coverage_score: 0,
          recommended_strategy: "Preview input unavailable",
          readiness_tier: "insufficient",
          readiness_score: 0,
        },
        backup_recommendations: [],
        committee: {
          coverage: {
            required_roles: [],
            covered_roles: [],
            missing_roles: [],
            coverage_score: 0,
            coverage_tier: "insufficient",
          },
          recommendation: {
            recommended_strategy: "No analysis performed",
            reasons: [],
            warnings: loaded.warnings,
          },
          summary: {
            total_contacts: 0,
            classified_contacts: 0,
            committee_strength: 0,
            recommendation: "Preview input unavailable",
          },
        },
        staged_plan: [],
        readiness: { ready: false, score: 0, tier: "insufficient", blockers: loaded.warnings },
        warnings: loaded.warnings,
      }
    }
    return buildAccountOutreachPreviewOutput(loaded.input)
  }

  return {
    qa_marker: GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_PREVIEW_QA_MARKER,
    summary: {
      total_contacts: 0,
      recommended_contacts: 0,
      committee_coverage_score: 0,
      recommended_strategy: "Use --fixture or --input=path",
      readiness_tier: "insufficient",
      readiness_score: 0,
    },
    backup_recommendations: [],
    committee: {
      coverage: {
        required_roles: [],
        covered_roles: [],
        missing_roles: [],
        coverage_score: 0,
        coverage_tier: "insufficient",
      },
      recommendation: {
        recommended_strategy: "Use --fixture or --input=path",
        reasons: [],
        warnings: ["no_input_source"],
      },
      summary: {
        total_contacts: 0,
        classified_contacts: 0,
        committee_strength: 0,
        recommendation: "No input source provided",
      },
    },
    staged_plan: [],
    readiness: { ready: false, score: 0, tier: "insufficient", blockers: ["no_input_source"] },
    warnings: ["no_input_source", "use_fixture_or_input"],
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const shadowLog = argv.includes("--shadow-log")
  const previewArgv = argv.filter((arg) => arg !== "--shadow-log")
  const preview = sanitizePreviewValue(await runAccountOutreachPreview(previewArgv))

  if (shadowLog) {
    let shadowInput: AccountOutreachPreviewInput | null = null
    if (previewArgv.includes("--fixture")) {
      shadowInput = buildAccountOutreachPreviewFixtures()
    } else {
      const inputArg = previewArgv.find((arg) => arg.startsWith("--input="))
      if (inputArg) {
        const loaded = loadAccountOutreachPreviewInput(inputArg.slice("--input=".length).trim())
        shadowInput = loaded.input
      }
    }

    const shadow_log = shadowInput
      ? await buildAccountOutreachPreviewShadowLog(shadowInput)
      : {
          qa_marker: GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW_QA_MARKER,
          shadow: "account_outreach_strategy" as const,
          company_present: false,
          domain_present: false,
          total_contacts: 0,
          primary_contact_present: false,
          readiness_tier: "insufficient",
          readiness_score: 0,
          committee_coverage_score: 0,
          backup_count: 0,
          staged_plan_steps: 0,
          warnings: ["no_input_source"],
        }

    process.stdout.write(`${JSON.stringify({ preview, shadow_log })}\n`)
    return
  }

  process.stdout.write(`${JSON.stringify(preview)}\n`)
}

const isDirectExecution = Boolean(
  process.argv[1]?.endsWith("/account-outreach-recommendation-preview.ts") ||
    process.argv[1]?.endsWith("\\account-outreach-recommendation-preview.ts"),
)
if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}

export { assertContactEngagementPreviewHasNoPlaintextEmails, sanitizePreviewValue }
