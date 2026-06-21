/**
 * GS-AI-PLAYBOOK-3A certification — account intelligence enrichment layer.
 */

import assert from "node:assert/strict"
import { buildGrowthAiCopilotUserPrompt } from "@/lib/growth/ai-copilot-prompts"
import { buildOutreachRefinementUserPrompt } from "@/lib/growth/outreach/personalization/ai-refinement-prompts"
import {
  buildGrowthAccountIntelligence,
  GROWTH_ACCOUNT_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/account-intelligence/growth-account-intelligence-builder"
import {
  dedupeAccountIntelligenceSignals,
  normalizeAccountIntelligenceSignals,
} from "@/lib/growth/account-intelligence/growth-account-intelligence-normalizer"
import { GROWTH_ACCOUNT_INTELLIGENCE_SOURCE_PRECEDENCE } from "@/lib/growth/account-intelligence/growth-account-intelligence-signals"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildIndustryContextPromptBlock } from "@/lib/growth/playbooks/growth-industry-context-prompts"
import {
  buildGrowthPlaybookOrchestratedPrompt,
  buildGrowthPlaybookOrchestratedPromptBlock,
} from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import { buildPersonalizationUserPrompt } from "@/lib/growth/personalization/personalization-prompt"
import type { GrowthPersonalizationContext } from "@/lib/growth/personalization/personalization-types"

const CERT_SECTION = process.env.GS_PLAYBOOK_3A_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

const sterlingVerified = [
  "provides field service and biomedical support for medical equipment organizations",
]

function buildSterlingContext() {
  return buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    description: "Sterling Biomedical provides biomedical field service and PM support for hospitals.",
    naics: ["621999"],
    verifiedFacts: sterlingVerified,
    researchSignals: ["PM compliance tracking for patient-connected devices", "Joint Commission survey preparation"],
    hiringSignals: ["Hiring biomedical field service technicians"],
    websiteSignals: ["Site excerpt: regulated PM scheduling and recall traceability for infusion pumps"],
    decisionMakerTitle: "HTM Director",
    accountIntelligence: {
      enrichmentFindings: ["CRM detected: spreadsheet PM tracking"],
      websiteFindings: ["Customer portal not detected on public website"],
      researchConfidence: 86,
      leadMetadata: {
        fieldServiceStackDetected: "spreadsheet + email dispatch",
      },
    },
  })
}

function runSignalsCert(): void {
  assert.equal(GROWTH_ACCOUNT_INTELLIGENCE_QA_MARKER, "growth-account-intelligence-gs-ai-playbook-3a-v1")
  assert.equal(GROWTH_ACCOUNT_INTELLIGENCE_SOURCE_PRECEDENCE.crm_metadata, 1)
  const signals = normalizeAccountIntelligenceSignals({
    verifiedFacts: ["provides biomedical field service"],
    researchFindings: ["Teams dispatch field technicians for emergency repairs"],
    websiteFindings: ["Public site mentions hospital and surgery center support"],
    leadMetadata: { crmDetected: "ServiceTitan" },
  })
  const deduped = dedupeAccountIntelligenceSignals(signals)
  const crmSignal = deduped.find((entry) => entry.claim.includes("ServiceTitan"))
  assert(crmSignal)
  assert.equal(crmSignal!.source, "crm_metadata")
  assert.ok(deduped.some((entry) => entry.category === "operational"))
  console.log("✓ signals — normalization + source precedence")
}

function runSummaryCert(): void {
  const context = buildSterlingContext()
  const model = context.accountIntelligenceContext!.model
  assert.ok(model.companySummary.length >= 2)
  assert.ok(model.complianceIndicators.length >= 1 || model.operationalSignals.length >= 1)
  assert.ok(model.confidence >= 60)
  assert.ok(!model.companySummary.some((entry) => /\bmay\b|\bmight\b|\bprobably\b/i.test(entry)))
  console.log("✓ summary — verified bullets without speculative inference")
}

function runAccountIntelligenceCert(): void {
  const built = buildGrowthAccountIntelligence({
    companyName: "Sterling Biomedical",
    companySummary: "Provides biomedical field service",
    verifiedFacts: sterlingVerified,
    websiteFindings: ["Supports hospitals and surgery centers"],
    enrichmentFindings: ["Field service stack detected: spreadsheet dispatch"],
  })
  assert.ok(built.diagnostics.signalCount >= 3)
  assert.ok(built.diagnostics.sourceBreakdown.research >= 1)
  assert.ok(built.promptSections.verifiedCompanySummary.includes("-"))
  console.log("✓ account intelligence builder — model + diagnostics + prompt sections")
}

function runPromptIntegrationCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "email",
  })!
  assert(orchestrated.accountIntelligenceDiagnostics)
  assert(orchestrated.formattedBlock.includes("=== Verified Company Summary ==="))
  assert(orchestrated.formattedBlock.includes("=== Verified Operational Signals ==="))
  assert(orchestrated.formattedBlock.includes("=== Buyer Persona Framework ==="))
  const summaryIdx = orchestrated.formattedBlock.indexOf("Verified Company Summary")
  const personaIdx = orchestrated.formattedBlock.indexOf("Buyer Persona Framework")
  assert(summaryIdx >= 0 && personaIdx > summaryIdx)
  const industryIdx = orchestrated.formattedBlock.indexOf("Industry Intelligence")
  if (industryIdx >= 0) {
    assert(summaryIdx < industryIdx)
    assert(industryIdx < personaIdx)
  }
  console.log("✓ prompt integration — account sections before industry/persona blocks")
}

function runOutreachCert(): void {
  const context = buildSterlingContext()
  const prompt = buildOutreachRefinementUserPrompt({
    draft: { subject: "Test", body: "Draft body", wordCount: 10 },
    blocks: [],
    allowedFacts: sterlingVerified,
    industryContext: context,
    maxWords: 120,
  })
  const parsed = JSON.parse(prompt) as {
    narrativeOrchestration?: { accountIntelligenceDiagnostics?: { signalCount?: number } }
  }
  assert((parsed.narrativeOrchestration?.accountIntelligenceDiagnostics?.signalCount ?? 0) >= 3)
  console.log("✓ outreach — account diagnostics in refinement JSON")
}

function runEmailCert(): void {
  const context = buildSterlingContext()
  const prompt = buildPersonalizationUserPrompt({
    context: {
      companyName: "Sterling Biomedical",
      industryLabel: "biomedical equipment service",
      companySignals: sterlingVerified,
      websiteSignals: [],
      researchPainPoints: [],
      buyingSignals: [],
      opportunitySignals: [],
      hiringSignals: [],
    } satisfies GrowthPersonalizationContext,
    evidence: [],
    industryContext: context,
  })
  assert.match(prompt, /Verified Company Summary/)
  assert.match(prompt, /Verified Operational Signals/)
  console.log("✓ Stack A email — account intelligence sections in prompt")
}

function runSendrCert(): void {
  const context = buildSterlingContext()
  const block = buildIndustryContextPromptBlock(context, "page")
  assert.match(block, /Verified Company Summary/)
  assert.match(block, /Verified Customer Signals|Verified Differentiators/)
  console.log("✓ Sendr/share — account intelligence in page prompt")
}

function runShareCert(): void {
  const context = buildSterlingContext()
  const block = buildGrowthPlaybookOrchestratedPromptBlock({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "page",
  })
  assert.match(block, /Verified Growth Signals/)
  assert.match(block, /Verified Technology Signals/)
  console.log("✓ share page — full account intelligence sections")
}

function runRegressionCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "email",
  })!
  assert(orchestrated.promptOptimization!.weightingPreserved)
  assert(orchestrated.personaDiagnostics?.frameworkApplied)
  assert(orchestrated.formattedBlock.includes("=== Narrative Direction ==="))

  const sms = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "sms",
  })!
  assert.ok(sms.promptOptimization!.estimatedPromptSize <= sms.promptOptimization!.budgetLimit)

  const copilotPrompt = buildGrowthAiCopilotUserPrompt(
    "cold_email",
    {
      companyName: "Sterling Biomedical",
      contactName: "Alex",
      fitScore: 80,
      engagementTier: "warm",
      engagementSummary: "Opened email",
      relationshipTier: "new",
      relationshipTrend: "neutral",
      opportunityTier: "medium",
      opportunityBlockers: [],
      opportunityAccelerators: [],
      revenueTier: "medium",
      revenueTrajectory: "stable",
      executiveTier: "standard",
      executiveRecommendation: "continue",
      capacityTier: "available",
      capacityProtection: "none",
      researchSummary: "Biomedical service",
      researchNextAction: "Outreach",
      decisionMakers: [],
      nextBestAction: "email",
      nextBestActionReason: "fit",
      recentOutbound: [],
      replyPreview: null,
      frameworks: { objections: [], buyingSignals: [], commitmentSignals: [] },
      relationshipMemory: null,
    },
    { industryContext: context, narrativeContext: context.narrativeContext },
  )
  const parsed = JSON.parse(copilotPrompt) as {
    accountIntelligenceDiagnostics?: { signalCount?: number }
  }
  assert((parsed.accountIntelligenceDiagnostics?.signalCount ?? 0) >= 3)
  console.log("✓ regression — 2E persona + 2D SMS budget + copilot diagnostics preserved")
}

const runners: Array<[string, () => void]> = [
  ["signals", runSignalsCert],
  ["summary", runSummaryCert],
  ["builder", runAccountIntelligenceCert],
  ["prompts", runPromptIntegrationCert],
  ["outreach", runOutreachCert],
  ["email", runEmailCert],
  ["sendr", runSendrCert],
  ["share", runShareCert],
  ["regression", runRegressionCert],
]

for (const [name, run] of runners) {
  if (section(name)) run()
}

if (CERT_SECTION === "all") {
  console.log("\nGS-AI-PLAYBOOK-3A account intelligence certification passed.")
}
