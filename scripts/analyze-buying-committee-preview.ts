/**
 * GE-IRE-6D — offline Buying Committee preview CLI.
 *
 * Fixture mode (CI-safe):
 *   pnpm test:growth-buying-committee-preview
 *
 * File input:
 *   pnpm growth:buying-committee-preview -- --input=./account.json
 */

import fs from "node:fs"
import path from "node:path"
import { analyzeBuyingCommittee } from "../lib/growth/contact-verification/buying-committee-intelligence"
import { recommendContacts } from "../lib/growth/contact-verification/contact-recommendation-engine"
import {
  assertContactEngagementPreviewHasNoPlaintextEmails,
  predictContactEngagement,
  sanitizePreviewValue,
} from "../lib/growth/contact-verification/contact-engagement-prediction"
import { buildEmailLearningObservation } from "../lib/growth/contact-verification/email-learning"
import { buildCompanyPatternEvidenceFromCounts } from "../lib/growth/contact-verification/identity-resolution-engine"
import type { BuyingCommitteeIntelligenceResult } from "../lib/growth/contact-verification/buying-committee-intelligence"
import type { EmailLearningObservation } from "../lib/growth/contact-verification/email-learning"

export const GROWTH_BUYING_COMMITTEE_PREVIEW_QA_MARKER = "growth-buying-committee-preview-v1" as const

export type BuyingCommitteePreviewInput = {
  companyName?: string
  domain?: string
  industry?: string
  targetUseCase?: "growth_engine" | "equipify_core" | "service_operations" | "generic"
  contacts: Array<Record<string, unknown>>
  historicalLearning?: EmailLearningObservation[] | Array<Record<string, unknown>>
}

export type BuyingCommitteePreviewTopContact = {
  rank: number
  display_name: string
  primary_role?: string
  engagement_tier: string
  reply_probability: number
  meeting_probability: number
  overall_score: number
  recommended_email_present: boolean
  recommended_email_masked?: string | null
}

export type BuyingCommitteePreviewOutput = {
  qa_marker: typeof GROWTH_BUYING_COMMITTEE_PREVIEW_QA_MARKER
  summary: BuyingCommitteeIntelligenceResult["summary"] & {
    coverage_tier?: string
    committee_strength?: number
  }
  recommendation: {
    primary_contact?: string
    primary_role?: string
    recommended_strategy: string
    reasons: string[]
    warnings: string[]
    recommended_email_present: boolean
    recommended_email_masked?: string | null
  }
  coverage: BuyingCommitteeIntelligenceResult["coverage"]
  top_contacts: BuyingCommitteePreviewTopContact[]
  warnings: string[]
}

export function buildBuyingCommitteePreviewFixtures(): BuyingCommitteePreviewInput {
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
      email: "john.smith@precisionbiomedical.com",
      outcome: "opened",
      source: "provider_webhook",
      eventTimestamp: "2026-06-03T11:00:00.000Z",
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
      },
      {
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Director of Operations",
        department: "operations",
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

export function parseBuyingCommitteePreviewInput(raw: unknown): {
  input: BuyingCommitteePreviewInput | null
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
    },
    warnings,
  }
}

export function loadBuyingCommitteePreviewInput(filePath: string): {
  input: BuyingCommitteePreviewInput | null
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
    return parseBuyingCommitteePreviewInput(parsed)
  } catch (error) {
    return {
      input: null,
      warnings: [`preview_input_read_failed:${error instanceof Error ? error.message : "unknown"}`],
    }
  }
}

export async function buildBuyingCommitteePreviewOutput(
  previewInput: BuyingCommitteePreviewInput,
): Promise<BuyingCommitteePreviewOutput> {
  const historicalLearning = normalizeHistoricalLearning(previewInput.historicalLearning)
  const companyPatternEvidence = previewInput.domain
    ? buildCompanyPatternEvidenceFromCounts({
        domain: previewInput.domain,
        pattern_counts: { first_dot_last: 25, first_initial_last: 3 },
      })
    : null

  const contacts = previewInput.contacts.map((contact) => ({
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

  const committeeInput = {
    companyName: previewInput.companyName,
    domain: previewInput.domain,
    industry: previewInput.industry,
    targetUseCase: previewInput.targetUseCase,
    companyPatternEvidence,
    historicalLearning,
    contacts,
  }

  const [analysis, contactRecommendations] = await Promise.all([
    analyzeBuyingCommittee(committeeInput, { skipDns: true }),
    recommendContacts(
      {
        companyName: previewInput.companyName,
        domain: previewInput.domain,
        industry: previewInput.industry,
        historicalLearning,
        companyPatternEvidence,
        contacts,
      },
      { skipDns: true },
    ),
  ])

  const top_contacts: BuyingCommitteePreviewTopContact[] = []

  for (const recommendation of contactRecommendations.recommended.slice(0, 5)) {
    const prediction = predictContactEngagement({
      companyName: previewInput.companyName,
      domain: previewInput.domain,
      industry: previewInput.industry,
      contact: {
        firstName: recommendation.contact.first_name,
        lastName: recommendation.contact.last_name,
        fullName: recommendation.contact.display_name,
        email: recommendation.contact.email,
        jobTitle: recommendation.contact.job_title,
        department: recommendation.contact.department,
        seniority: recommendation.contact.seniority,
      },
      historicalLearning,
    })

    top_contacts.push({
      rank: recommendation.rank,
      display_name: recommendation.contact.display_name,
      primary_role: analysis.recommendation.primary_contact?.contact.display_name ===
        recommendation.contact.display_name
        ? analysis.recommendation.primary_role
        : undefined,
      engagement_tier: prediction.engagement_tier,
      reply_probability: prediction.reply_probability,
      meeting_probability: prediction.meeting_probability,
      overall_score: recommendation.scores.overall,
      recommended_email_present: Boolean(recommendation.recommended_email),
      recommended_email_masked: recommendation.recommended_email ? "***@***" : null,
    })
  }

  return {
    qa_marker: GROWTH_BUYING_COMMITTEE_PREVIEW_QA_MARKER,
    summary: {
      ...analysis.summary,
      coverage_tier: analysis.coverage.coverage_tier,
      committee_strength: analysis.summary.committee_strength,
    },
    recommendation: {
      primary_contact: analysis.recommendation.primary_contact?.contact.display_name,
      primary_role: analysis.recommendation.primary_role,
      recommended_strategy: analysis.recommendation.recommended_strategy,
      reasons: analysis.recommendation.reasons,
      warnings: analysis.recommendation.warnings,
      recommended_email_present: Boolean(analysis.recommendation.primary_contact?.recommended_email),
      recommended_email_masked: analysis.recommendation.primary_contact?.recommended_email
        ? "***@***"
        : null,
    },
    coverage: analysis.coverage,
    top_contacts,
    warnings: analysis.warnings,
  }
}

export async function runBuyingCommitteePreview(argv: string[]): Promise<BuyingCommitteePreviewOutput> {
  let fixture = false
  let inputPath: string | null = null

  for (const arg of argv) {
    if (arg === "--fixture") fixture = true
    if (arg.startsWith("--input=")) inputPath = arg.slice("--input=".length).trim() || null
  }

  if (fixture) {
    return buildBuyingCommitteePreviewOutput(buildBuyingCommitteePreviewFixtures())
  }

  if (inputPath) {
    const loaded = loadBuyingCommitteePreviewInput(inputPath)
    if (!loaded.input) {
      return {
        qa_marker: GROWTH_BUYING_COMMITTEE_PREVIEW_QA_MARKER,
        summary: {
          total_contacts: 0,
          classified_contacts: 0,
          committee_strength: 0,
          recommendation: "Preview input unavailable",
        },
        recommendation: {
          recommended_strategy: "No analysis performed",
          reasons: [],
          warnings: loaded.warnings,
          recommended_email_present: false,
        },
        coverage: {
          required_roles: [],
          covered_roles: [],
          missing_roles: [],
          coverage_score: 0,
          coverage_tier: "insufficient",
        },
        top_contacts: [],
        warnings: loaded.warnings,
      }
    }
    return buildBuyingCommitteePreviewOutput(loaded.input)
  }

  return {
    qa_marker: GROWTH_BUYING_COMMITTEE_PREVIEW_QA_MARKER,
    summary: {
      total_contacts: 0,
      classified_contacts: 0,
      committee_strength: 0,
      recommendation: "No input source provided",
    },
    recommendation: {
      recommended_strategy: "Use --fixture or --input=path",
      reasons: [],
      warnings: ["no_input_source"],
      recommended_email_present: false,
    },
    coverage: {
      required_roles: [],
      covered_roles: [],
      missing_roles: [],
      coverage_score: 0,
      coverage_tier: "insufficient",
    },
    top_contacts: [],
    warnings: ["no_input_source", "use_fixture_or_input"],
  }
}

async function main(): Promise<void> {
  const output = sanitizePreviewValue(await runBuyingCommitteePreview(process.argv.slice(2)))
  process.stdout.write(`${JSON.stringify(output)}\n`)
}

const isDirectExecution = Boolean(
  process.argv[1]?.endsWith("/analyze-buying-committee-preview.ts") ||
    process.argv[1]?.endsWith("\\analyze-buying-committee-preview.ts"),
)
if (isDirectExecution) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}

export { assertContactEngagementPreviewHasNoPlaintextEmails, sanitizePreviewValue }
