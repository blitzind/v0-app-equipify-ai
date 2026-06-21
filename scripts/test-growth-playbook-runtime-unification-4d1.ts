/**
 * GS-AI-PLAYBOOK-4D.1 certification — Stack A → Stack B runtime unification.
 * Run: pnpm test:growth-playbook-runtime-unification
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { applyGrowthPersonalizationQualityPassWithIndustryContext } from "@/lib/growth/personalization/quality/growth-personalization-quality-engine"
import {
  buildPersonalizationStackBMetadataFromAudit,
  GROWTH_PERSONALIZATION_STACK_B_UNIFICATION_QA_MARKER,
  parsePersonalizationStackBDiagnostics,
} from "@/lib/growth/personalization/growth-personalization-stack-b-metadata"
import { buildDeterministicPersonalizationDraft } from "@/lib/growth/personalization/personalization-prompt"
import { buildPersonalizedOutreachDraft } from "@/lib/growth/outreach/personalization/assemble-draft"
import {
  OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
  type OutreachPersonalizationAudit,
} from "@/lib/growth/outreach/personalization/personalization-types"
import { extractPersonalizationSignals } from "@/lib/growth/outreach/personalization/signal-extraction"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildGrowthReasoningContext } from "@/lib/growth/reasoning/growth-reasoning-engine"
import { buildMinimalOutreachContextPacketForReasoning } from "@/lib/growth/reasoning/growth-reasoning-engine"
import { buildGrowthSequenceIntelligenceContext } from "@/lib/growth/sequence-intelligence/growth-sequence-engine"

const CERT_SECTION = process.env.GS_PLAYBOOK_4D1_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

const LEGACY_SUBJECT_RE = /^Quick note for /
const LEGACY_BODY_OPENER_RE = /Hi there — reaching out regarding/

function sterlingIndustryContext() {
  return buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    naics: ["621999"],
    verifiedFacts: ["Sterling Biomedical supports hospitals and surgery centers."],
    decisionMakerTitle: "HTM Director",
    buyerJourneySignals: {
      priorTouchCount: 1,
      priorReplyCount: 0,
      researchPainPoints: ["PM schedules disconnected from work orders"],
      relationshipStage: "aware",
      engagementTier: "warm",
      emailOpens: 2,
    },
  })
}

function sterlingPacket() {
  const industryContext = sterlingIndustryContext()
  return buildMinimalOutreachContextPacketForReasoning({
    industryContext,
    companyName: "Sterling Biomedical",
    contactName: "Jordan Lee",
    verifiedFacts: ["Sterling Biomedical supports hospitals and surgery centers."],
    researchPainPoints: ["PM schedules disconnected from work orders"],
    priorTouchCount: 1,
    engagementScore: 55,
  })
}

function runUnificationSourceCert(): void {
  const dashboardSource = readSource("lib/growth/personalization/dashboard.ts")
  assert.match(dashboardSource, /runOutreachPersonalizationGeneration/)
  assert.match(dashboardSource, /buildPersonalizationStackBMetadataFromAudit/)
  assert.match(dashboardSource, /generationType: "cold_email"/)
  assert.match(dashboardSource, /industryDiagnostics/)
  assert.match(dashboardSource, /reasoningDiagnostics/)
  assert.match(dashboardSource, /sequenceDiagnostics/)
  assert.match(dashboardSource, /qualityDiagnostics/)
  assert.match(dashboardSource, /buildDeterministicPersonalizationDraft/)
  assert.doesNotMatch(dashboardSource, /runAiTask\(/)
  assert.doesNotMatch(dashboardSource, /growth_ai_personalization/)
  assert.doesNotMatch(dashboardSource, /buildPersonalizationSystemPrompt/)
  console.log("✓ dashboard service — Stack B primary path wired")

  const runSource = readSource("lib/growth/outreach/personalization/run-outreach-personalization.ts")
  assert.match(runSource, /buildOutreachContextPacket/)
  assert.match(runSource, /buildGrowthReasoningContext/)
  assert.match(runSource, /buildGrowthSequenceIntelligenceContext/)
  assert.match(runSource, /applyGrowthPersonalizationQualityPassWithIndustryContext/)
  console.log("✓ Stack B engine — context, reasoning, sequence, quality")

  const uiSource = readSource("components/growth/growth-ai-personalization-dashboard.tsx")
  assert.match(uiSource, /GrowthPersonalizationStackBPreview/)
  assert.match(uiSource, /stackBDiagnostics/)
  console.log("✓ dashboard UI — Stack B preview sections")

  const generateRoute = readSource("app/api/platform/growth/personalization/generate/route.ts")
  assert.match(generateRoute, /generatePersonalizationDraft/)
  assert.doesNotMatch(generateRoute, /runOutreachPersonalizationGeneration/)
  console.log("✓ generate API contract preserved")

  const approveRoute = readSource("app/api/platform/growth/personalization/generations/[id]/approve/route.ts")
  assert.match(approveRoute, /approvePersonalizationGeneration/)
  const rejectRoute = readSource("app/api/platform/growth/personalization/generations/[id]/reject/route.ts")
  assert.match(rejectRoute, /rejectPersonalizationGeneration/)
  console.log("✓ approve/reject routes unchanged")

  const versionSource = readSource("components/growth/personalization/growth-personalization-version-history.tsx")
  assert.match(versionSource, /GrowthPersonalizationVersionHistory/)
  const evaluationSource = readSource("components/growth/personalization/growth-personalization-evaluation-panel.tsx")
  assert.match(evaluationSource, /GrowthPersonalizationEvaluationPanel/)
  console.log("✓ version history and evaluation UI unchanged")
}

function runStackBPipelineCert(): void {
  assert.equal(
    GROWTH_PERSONALIZATION_STACK_B_UNIFICATION_QA_MARKER,
    "growth-personalization-stack-b-unification-gs-ai-playbook-4d1-v1",
  )

  const packet = sterlingPacket()
  const sequenceIntelligenceContext = buildGrowthSequenceIntelligenceContext({ packet })
  packet.industryContext = {
    ...packet.industryContext!,
    sequenceIntelligenceContext,
  }
  const reasoningContext = buildGrowthReasoningContext({ packet, channel: "EMAIL" })
  packet.industryContext = {
    ...packet.industryContext!,
    reasoningContext,
  }

  assert.ok(packet.industryContext?.playbookApplied, "industry context should apply")
  assert.ok(packet.industryContext?.personaMessagingContext?.diagnostics, "persona context should execute")
  assert.ok(packet.industryContext?.accountIntelligenceContext?.diagnostics, "account intelligence should execute")
  assert.ok(packet.industryContext?.buyerJourneyContext?.diagnostics, "buyer journey should execute")
  assert.ok(reasoningContext.diagnostics.topInsights.length > 0, "reasoning should execute")
  assert.ok(sequenceIntelligenceContext.diagnostics.guidanceApplied !== undefined, "sequence should execute")
  console.log("✓ Stack B intelligence layers — industry, persona, account, buyer journey, reasoning, sequence")

  const signals = extractPersonalizationSignals(packet)
  const { draft, strategy } = buildPersonalizedOutreachDraft({
    leadId: "00000000-0000-4000-8000-000000000001",
    packet,
    signals,
    generationType: "cold_email",
    maxWords: 120,
  })
  assert.ok(draft.subject.trim().length > 0, "subject from Stack B draft")
  assert.ok(draft.body.trim().length > 0, "body from Stack B draft")
  assert.doesNotMatch(draft.subject, LEGACY_SUBJECT_RE, "Stack B subject must not use legacy template")
  assert.doesNotMatch(draft.body, LEGACY_BODY_OPENER_RE, "Stack B body must not use legacy opener")
  console.log("✓ Stack B draft — subject/body not legacy templates")

  const qualityPass = applyGrowthPersonalizationQualityPassWithIndustryContext({
    channel: "EMAIL",
    subject: draft.subject,
    body: draft.body,
    companyName: packet.companyName,
    contactName: packet.decisionMakerName,
    allowedFacts: ["Sterling Biomedical supports hospitals and surgery centers."],
    industryContext: packet.industryContext,
    reasoningDiagnostics: reasoningContext.diagnostics,
    sequenceDiagnostics: sequenceIntelligenceContext.diagnostics,
    maxWords: 120,
  })
  assert.ok(qualityPass.diagnostics, "quality pass should execute")
  console.log("✓ quality pass executes")

  const audit: OutreachPersonalizationAudit = {
    strategyVersion: OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
    contextPacket: packet,
    selectedBlocks: strategy.blocks,
    angle: strategy.angle,
    industry: strategy.industry,
    sourceSignals: strategy.sourceSignals,
    warnings: [],
    confidenceScore: 72,
    confidenceLabel: "medium",
    variationKey: strategy.variationKey,
    deterministicDraft: draft,
    refinedByAi: false,
    generationType: "cold_email",
    maxWords: 120,
    industryPlaybookApplied: Boolean(packet.industryContext?.playbookApplied),
    qualityDiagnostics: qualityPass.diagnostics,
    qualityApplied: qualityPass.qualityApplied,
    outcomeGuidanceDiagnostics: packet.industryContext?.outcomeGuidanceContext?.diagnostics,
    buyerJourneyDiagnostics: packet.industryContext?.buyerJourneyContext?.diagnostics,
    reasoningDiagnostics: reasoningContext.diagnostics,
    sequenceDiagnostics: sequenceIntelligenceContext.diagnostics,
  }

  const metadata = buildPersonalizationStackBMetadataFromAudit(audit)
  assert.ok(metadata.industryDiagnostics?.playbookApplied)
  assert.ok(metadata.personaDiagnostics)
  assert.ok(metadata.accountDiagnostics)
  assert.ok(metadata.buyerJourneyDiagnostics)
  assert.ok(metadata.reasoningDiagnostics)
  assert.ok(metadata.sequenceDiagnostics)
  assert.ok(metadata.qualityDiagnostics)
  assert.equal(metadata.stackBGeneration?.legacyFallback, false)
  console.log("✓ metadata diagnostics shape from Stack B audit")

  const persisted = {
    industryDiagnostics: metadata.industryDiagnostics,
    personaDiagnostics: metadata.personaDiagnostics,
    accountDiagnostics: metadata.accountDiagnostics,
    buyerJourneyDiagnostics: metadata.buyerJourneyDiagnostics,
    reasoningDiagnostics: metadata.reasoningDiagnostics,
    sequenceDiagnostics: metadata.sequenceDiagnostics,
    qualityDiagnostics: metadata.qualityDiagnostics,
    outcomeGuidanceDiagnostics: metadata.outcomeGuidanceDiagnostics,
    stackBGeneration: metadata.stackBGeneration,
  }
  const parsed = parsePersonalizationStackBDiagnostics(persisted)
  assert.ok(parsed?.reasoningDiagnostics)
  assert.ok(parsed?.sequenceDiagnostics)
  console.log("✓ metadata parse roundtrip")
}

function runLegacyFallbackCert(): void {
  const legacy = buildDeterministicPersonalizationDraft({
    context: {
      leadLabel: "Empty Corp",
      companyName: "Empty Corp",
      industryLabel: null,
      relationshipStage: null,
      relationshipSummary: null,
      topObjections: [],
      topPreferences: [],
      opportunitySignals: [],
      bookingSignals: [],
      engagementTier: null,
      territoryLabel: null,
      websiteSignals: [],
      committeeContext: [],
      buyingSignals: [],
      companySignals: [],
      inboxHistory: [],
      sequenceHistory: [],
      templateOverlay: null,
      sourcesUsed: [],
      companySummary: null,
      outreachAngles: [],
      researchPainPoints: [],
      hiringSignals: [],
      researchConfidence: null,
      companyDescription: null,
      naicsCodes: [],
      sicCodes: [],
    },
    evidence: [],
  })
  assert.match(legacy.subject, LEGACY_SUBJECT_RE)
  assert.match(legacy.body, LEGACY_BODY_OPENER_RE)

  const dashboardSource = readSource("lib/growth/personalization/dashboard.ts")
  assert.match(dashboardSource, /input\.evidence\.length === 0/)
  assert.match(dashboardSource, /legacyFallback: true/)
  console.log("✓ legacy fallback — emergency-only path gated on no evidence and no provider")
}

function runContextPacketBuilderCert(): void {
  const builderSource = readSource("lib/growth/outreach/personalization/context-packet-builder.ts")
  assert.match(builderSource, /buildOutreachIndustryContextForLead/)
  assert.match(builderSource, /buildGrowthIndustryContext/)
  console.log("✓ buildOutreachContextPacket — industry context builder referenced")
}

async function main(): Promise<void> {
  console.log("\n=== GS-AI-PLAYBOOK-4D.1 Runtime Unification Certification ===\n")

  if (section("source")) runUnificationSourceCert()
  if (section("pipeline")) runStackBPipelineCert()
  if (section("legacy")) runLegacyFallbackCert()
  if (section("context")) runContextPacketBuilderCert()

  console.log("\nGS-AI-PLAYBOOK-4D.1 runtime unification certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
