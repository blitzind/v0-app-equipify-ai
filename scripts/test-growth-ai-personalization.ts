/**
 * Regression checks for AI Prospect Personalization Layer (Phase 2V).
 * Run: pnpm test:growth-ai-personalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildPersonalizationEvidenceFromContext,
  computeEvidenceCoverageScore,
} from "../lib/growth/personalization/personalization-evidence-engine"
import {
  buildDeterministicPersonalizationDraft,
  parsePersonalizationModelOutput,
} from "../lib/growth/personalization/personalization-prompt"
import {
  detectPersonalizationRisks,
  shouldBlockPersonalization,
} from "../lib/growth/personalization/personalization-risk-engine"
import {
  assertPersonalizationCanBeApproved,
  assertPersonalizationCanBeSent,
  validatePersonalizationGeneration,
} from "../lib/growth/personalization/personalization-validator"
import { computeAttributionScore } from "../lib/growth/personalization/personalization-attribution"
import {
  GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER,
  GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
  GROWTH_AI_PERSONALIZATION_QA_MARKER,
  GROWTH_PERSONALIZATION_FEEDBACK_TYPES,
  GROWTH_PERSONALIZATION_GENERATION_STATUSES,
  GROWTH_PERSONALIZATION_RISK_LEVELS,
  GROWTH_PERSONALIZATION_SOURCES,
  sanitizePersonalizationEvidenceSnippet,
} from "../lib/growth/personalization/personalization-types"
import { GROWTH_AI_PERSONALIZATION_SCHEMA_MIGRATION } from "../lib/growth/personalization/schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_AI_PERSONALIZATION_QA_MARKER, "growth-ai-personalization-v1")
  assert.match(GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE, /human-gated only/i)
  assert.match(GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE, /No autonomous sends/i)
  assert.match(GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE, /no hallucinated company facts/i)
  assert.match(GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE, /no hidden AI generation/i)
  assert.equal(GROWTH_PERSONALIZATION_GENERATION_STATUSES.length, 6)
  assert.equal(GROWTH_PERSONALIZATION_SOURCES.length, 13)
  assert.equal(GROWTH_PERSONALIZATION_RISK_LEVELS.length, 4)
  assert.equal(GROWTH_PERSONALIZATION_FEEDBACK_TYPES.length, 5)

  const migration = readSource(`supabase/migrations/${GROWTH_AI_PERSONALIZATION_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.personalization_profiles/)
  assert.match(migration, /growth\.personalization_generations/)
  assert.match(migration, /growth\.personalization_evidence/)
  assert.match(migration, /growth\.personalization_risk_events/)
  assert.match(migration, /growth\.personalization_feedback/)
  assert.match(migration, /growth\.personalization_performance_snapshots/)
  assert.match(migration, /personalization_generated/)
  assert.match(migration, /personalization_blocked/)
  assert.match(migration, /service role only/i)

  const sanitized = sanitizePersonalizationEvidenceSnippet("Bearer secret-token api_key=abc123 uuid 550e8400-e29b-41d4-a716-446655440000")
  assert.match(sanitized, /\[redacted\]/i)
  assert.match(sanitized, /\[id\]/i)

  const context = {
    leadLabel: "Acme Corp",
    companyName: "Acme Corp",
    industryLabel: "Manufacturing",
    relationshipStage: "engaged",
    relationshipSummary: "Recent inbox engagement on pricing.",
    topObjections: ["Budget is tight this quarter."],
    topPreferences: ["Prefers email in the morning."],
    opportunitySignals: ["Evaluating operational tooling."],
    bookingSignals: ["Requested a demo slot."],
    engagementTier: "engaged",
    territoryLabel: "Midwest",
    websiteSignals: [],
    committeeContext: ["Ops lead involved."],
    buyingSignals: ["Budget discussion surfaced."],
    companySignals: ["Growing headcount."],
    inboxHistory: ["Asked about pricing last week."],
    sequenceHistory: ["Step 1 delivered."],
    templateOverlay: null,
    sourcesUsed: ["relationship_memory" as const, "opportunity_intelligence" as const],
    companySummary: null,
    outreachAngles: [],
    researchPainPoints: [],
    hiringSignals: [],
    researchConfidence: null,
    companyDescription: null,
    naicsCodes: [],
    sicCodes: [],
  }

  const evidence = buildPersonalizationEvidenceFromContext(context)
  assert.ok(evidence.length > 0)
  const coverage = computeEvidenceCoverageScore(evidence)
  assert.ok(coverage >= 0 && coverage <= 100)

  const draft = buildDeterministicPersonalizationDraft({ context, evidence })
  assert.match(draft.subject, /Acme Corp/)
  assert.match(draft.body, /Acme Corp/)

  const validation = validatePersonalizationGeneration({
    subject: draft.subject,
    body: draft.body,
    companyName: context.companyName,
    evidence,
  })
  assert.equal(validation.blocked, false)

  const blockedValidation = validatePersonalizationGeneration({
    subject: "Quick note",
    body: "We saw your team grew 40% — guaranteed results.",
    companyName: "Acme Corp",
    evidence: [],
  })
  assert.equal(blockedValidation.blocked, true)

  const risks = detectPersonalizationRisks({
    subject: "Guaranteed 100% ROI",
    body: "Your team grew 40% last quarter.",
    companyName: "Acme Corp",
    evidence: [{ sourceType: "relationship_memory", claimKey: "summary", evidenceSnippet: "Prefers email.", confidence: "medium" }],
  })
  assert.ok(shouldBlockPersonalization(risks))

  assert.throws(() => assertPersonalizationCanBeApproved({ status: "blocked", blockedReason: "Unsupported" }))
  assert.throws(() => assertPersonalizationCanBeSent({ status: "draft" }))

  const parsed = parsePersonalizationModelOutput(JSON.stringify({ subject: "Hello", body: "Evidence-backed note." }))
  assert.ok(parsed)
  assert.equal(parsed!.subject, "Hello")

  const attribution = computeAttributionScore({ evidenceCoverageScore: 80, personalizationScore: 70, performedWell: true })
  assert.ok(attribution >= 70 && attribution <= 100)

  const dashboardRoute = readSource("app/api/platform/growth/personalization/dashboard/route.ts")
  assert.match(dashboardRoute, /requireGrowthEnginePlatformAccess/)
  assert.match(dashboardRoute, /isGrowthAiPersonalizationSchemaReady/)

  const generateRoute = readSource("app/api/platform/growth/personalization/generate/route.ts")
  assert.match(generateRoute, /generatePersonalizationDraft/)

  const approveRoute = readSource("app/api/platform/growth/personalization/generations/[id]/approve/route.ts")
  assert.match(approveRoute, /humanApprovalConfirmed/)
  assert.match(approveRoute, /approvePersonalizationGeneration/)

  const sequenceSource = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(sequenceSource, /getApprovedPersonalizationForJob/)
  assert.match(sequenceSource, /personalizationGenerationId/)

  const governanceTypes = readSource("lib/growth/governance/governance-types.ts")
  assert.match(governanceTypes, /personalization_generate/)
  assert.match(governanceTypes, /personalization_approve/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /copilot\/personalization/)

  const pageSource = readSource("app/(admin)/admin/growth/copilot/personalization/page.tsx")
  assert.match(pageSource, /GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER/)
  assert.match(pageSource, /GrowthSectionLayout/)
  assert.match(pageSource, /max-w-7xl/)
  assert.match(pageSource, /data-qa=\{GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER\}/)

  const uiSource = readSource("components/growth/growth-ai-personalization-dashboard.tsx")
  assert.match(uiSource, /GROWTH_AI_PERSONALIZATION_QA_MARKER/)
  assert.match(uiSource, /GROWTH_AI_PERSONALIZATION_LAYOUT_ALIGNED_QA_MARKER/)
  assert.match(uiSource, /humanApprovalConfirmed/)
  assert.match(uiSource, /IndustryPlaybookDiagnosticsPanel/)
  assert.match(uiSource, /GrowthPersonalizationLeadPicker/)
  assert.match(uiSource, /GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER/)

  const promptSource = readSource("lib/growth/personalization/personalization-prompt.ts")
  assert.match(promptSource, /Verified facts/)
  assert.match(promptSource, /Industry context/)

  console.log("growth-ai-personalization: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
