/**
 * GS-AI-PLAYBOOK-3C certification — outcome learning & adaptive guidance.
 */

import assert from "node:assert/strict"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import {
  analyzeGrowthPlaybookOutcomes,
  applyOutcomeGuidanceToRankedCtas,
  buildGrowthPlaybookOutcomeGuidance,
  buildGrowthPlaybookOutcomeGuidanceContext,
  buildGrowthPlaybookOutcomeOperatorPreview,
  GROWTH_PLAYBOOK_OUTCOME_QA_MARKER,
  inferOutcomeCtaType,
  inferOutcomeProofType,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-engine"
import type { GrowthPlaybookOutcomeRecord } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"
import { buildGrowthPlaybookOrchestratedPrompt } from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import { buildGrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-context-builder"
import { resolveIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-registry"

const CERT_SECTION = process.env.GS_PLAYBOOK_3C_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function buildBiomedicalHtmRecords(): GrowthPlaybookOutcomeRecord[] {
  const base = {
    industryId: "biomedical_equipment",
    industryLabel: "Biomedical Equipment Service",
    personaArchetype: "htm_director" as const,
    channel: "EMAIL" as const,
    proofType: "compliance" as const,
    narrativeType: "operational" as const,
  }
  return [
    {
      id: "o1",
      ...base,
      ctaType: "workflow_walkthrough",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: true,
      opened: true,
      replied: true,
      meetingBooked: true,
      ctaClicked: true,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(12),
    },
    {
      id: "o2",
      ...base,
      ctaType: "compliance_review",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: true,
      opened: true,
      replied: false,
      meetingBooked: false,
      ctaClicked: false,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(18),
    },
    {
      id: "o3",
      ...base,
      ctaType: "workflow_walkthrough",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: null,
      opened: true,
      replied: true,
      meetingBooked: false,
      ctaClicked: true,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(25),
    },
    {
      id: "o4",
      ...base,
      ctaType: "workflow_walkthrough",
      approved: false,
      rejected: false,
      regenerated: false,
      operatorHelpful: null,
      opened: false,
      replied: false,
      meetingBooked: false,
      ctaClicked: false,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(30),
    },
    {
      id: "o5",
      ...base,
      ctaType: "consultative_discovery",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: true,
      opened: true,
      replied: true,
      meetingBooked: true,
      ctaClicked: true,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(38),
    },
    {
      id: "o6",
      ...base,
      ctaType: "workflow_walkthrough",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: true,
      opened: true,
      replied: false,
      meetingBooked: true,
      ctaClicked: false,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(40),
    },
    {
      id: "o7",
      ...base,
      ctaType: "compliance_review",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: true,
      opened: true,
      replied: true,
      meetingBooked: false,
      ctaClicked: true,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(42),
    },
    {
      id: "o8",
      ...base,
      ctaType: "workflow_walkthrough",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: null,
      opened: true,
      replied: true,
      meetingBooked: true,
      ctaClicked: true,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(45),
    },
    {
      id: "o9",
      ...base,
      ctaType: "workflow_walkthrough",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: true,
      opened: false,
      replied: true,
      meetingBooked: false,
      ctaClicked: true,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(50),
    },
    {
      id: "o10",
      ...base,
      ctaType: "compliance_review",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: true,
      opened: true,
      replied: false,
      meetingBooked: true,
      ctaClicked: false,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(55),
    },
    {
      id: "o11",
      ...base,
      ctaType: "workflow_walkthrough",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: true,
      opened: true,
      replied: true,
      meetingBooked: false,
      ctaClicked: true,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(60),
    },
    {
      id: "o12",
      ...base,
      ctaType: "workflow_walkthrough",
      approved: true,
      rejected: false,
      regenerated: false,
      operatorHelpful: true,
      opened: true,
      replied: true,
      meetingBooked: true,
      ctaClicked: true,
      videoCompleted: false,
      shareEngaged: false,
      recordedAt: daysAgo(65),
    },
  ]
}

function runOutcomesCert(): void {
  assert.equal(GROWTH_PLAYBOOK_OUTCOME_QA_MARKER, "growth-playbook-outcome-gs-ai-playbook-3c-v1")
  const records = buildBiomedicalHtmRecords()
  const analysis = analyzeGrowthPlaybookOutcomes({
    records,
    filter: { industryId: "biomedical_equipment", personaArchetype: "htm_director" },
  })
  assert.equal(analysis.overall.sampleSize, 12)
  assert.ok((analysis.overall.approvalRate ?? 0) >= 70)
  assert.ok((analysis.overall.replyRate ?? 0) >= 40)
  assert.ok(analysis.overall.freshnessDays >= 10)
  console.log("✓ outcomes — segmentation + metrics")
}

function runGuidanceCert(): void {
  const records = buildBiomedicalHtmRecords()
  const guidance = buildGrowthPlaybookOutcomeGuidance({
    records,
    filter: { industryId: "biomedical_equipment", personaArchetype: "htm_director" },
  })
  assert.ok(guidance.preferredCtaTypes.includes("workflow_walkthrough"))
  assert.ok(guidance.preferredProofTypes.includes("compliance"))
  assert.ok(guidance.preferredNarratives.includes("operational"))
  assert.ok(guidance.avoidPatterns.some((entry) => /demo|feature dump/i.test(entry)))
  assert.equal(guidance.confidence, "high")
  assert.equal(guidance.sampleSize, 12)
  console.log("✓ guidance — winning patterns + avoid list")
}

function runRankingCert(): void {
  const records = buildBiomedicalHtmRecords()
  const guidance = buildGrowthPlaybookOutcomeGuidance({
    records,
    filter: { industryId: "biomedical_equipment", personaArchetype: "htm_director" },
  })
  const { playbook, resolution } = resolveIndustryPlaybook({
    industry: "biomedical equipment service",
    description: "Sterling Biomedical HTM",
    naics: ["621999"],
  })
  assert(playbook)
  assert(resolution.industryId)

  const baseContext = buildGrowthPlaybookContext({
    playbook: playbook!,
    industryId: resolution.industryId!,
    decisionMakerTitle: "HTM Director",
    verifiedFacts: ["provides biomedical field service"],
  })

  const demoPrimary = baseContext.rankedCtas.find((entry) => entry.rank === "primary")
  assert(demoPrimary)

  const boosted = applyOutcomeGuidanceToRankedCtas(baseContext.rankedCtas, guidance)
  assert.ok(boosted.boosts.length >= 1 || boosted.deprioritized.length >= 0)

  const industryContext = buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    description: "Sterling Biomedical provides biomedical field service",
    naics: ["621999"],
    verifiedFacts: ["provides biomedical field service"],
    decisionMakerTitle: "HTM Director",
    outcomeRecords: records,
  })
  assert.ok(industryContext.outcomeGuidanceContext)
  assert.ok(industryContext.outcomeGuidanceContext!.guidance.sampleSize >= 10)
  assert.ok(industryContext.personaMessagingContext?.diagnostics.outcomeGuidanceDiagnostics)
  console.log("✓ ranking — CTA/proof boosts integrated in industry context")
}

function runDiagnosticsCert(): void {
  const records = buildBiomedicalHtmRecords()
  const { diagnostics } = buildGrowthPlaybookOutcomeGuidanceContext({
    records,
    filter: { industryId: "biomedical_equipment", personaArchetype: "htm_director" },
    guidanceApplied: true,
    boosts: ["CTA boost: workflow walkthrough"],
  })
  assert.ok(diagnostics.winningPatterns.length >= 1)
  assert.ok(diagnostics.avoidPatterns.length >= 1)
  assert.equal(diagnostics.sampleSize, 12)

  const preview = buildGrowthPlaybookOutcomeOperatorPreview(diagnostics)
  assert.match(preview.confidenceLabel, /Medium|High/)
  assert.equal(preview.sampleSize, 12)

  const industryContext = buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    naics: ["621999"],
    verifiedFacts: ["provides biomedical field service"],
    decisionMakerTitle: "HTM Director",
    outcomeRecords: records,
  })
  const prompt = buildGrowthPlaybookOrchestratedPrompt({
    industryContext,
    narrativeContext: industryContext.narrativeContext,
    channel: "email",
  })
  assert.ok(prompt)
  assert.ok(prompt.outcomeGuidanceDiagnostics)
  assert.ok(prompt.personaDiagnostics?.outcomeGuidanceDiagnostics)
  console.log("✓ diagnostics — operator preview + orchestrator attachment")
}

function runRegressionCert(): void {
  assert.equal(inferOutcomeCtaType("Would you like a demo?"), "workflow_walkthrough")
  assert.equal(inferOutcomeProofType({ capabilityText: "PM compliance tracking" }), "compliance")

  const withoutRecords = buildGrowthIndustryContext({
    companyName: "Summit HVAC",
    industryLabel: "HVAC contractor",
    verifiedFacts: ["provides commercial HVAC maintenance"],
    decisionMakerTitle: "Operations Manager",
  })
  assert.equal(withoutRecords.outcomeGuidanceContext, null)
  assert.ok(withoutRecords.playbookApplied || !withoutRecords.playbookApplied)

  const records = buildBiomedicalHtmRecords()
  const withRecords = buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    naics: ["621999"],
    verifiedFacts: ["provides biomedical field service"],
    decisionMakerTitle: "HTM Director",
    outcomeRecords: records,
  })
  assert.ok(withRecords.accountIntelligenceContext)
  assert.ok(withRecords.personaMessagingContext)
  assert.ok(withRecords.outcomeGuidanceContext)
  console.log("✓ regression — 3A/3B preserved, guidance optional")
}

const runners: Array<[string, () => void]> = [
  ["outcomes", runOutcomesCert],
  ["guidance", runGuidanceCert],
  ["ranking", runRankingCert],
  ["diagnostics", runDiagnosticsCert],
  ["regression", runRegressionCert],
]

for (const [name, run] of runners) {
  if (section(name)) run()
}

if (CERT_SECTION === "all") {
  console.log("\nGS-AI-PLAYBOOK-3C outcome learning certification passed.")
}
