/**
 * GS-AI-PLAYBOOK-2B certification — intelligent playbook consumption & context assembly.
 */

import assert from "node:assert/strict"
import { generateApolloVoiceDropScriptFromIndustryContext } from "@/lib/growth/apollo/apollo-voice-drop-script-generation"
import { buildIndustryPlaybookEvidenceBundle } from "@/lib/growth/personalization/personalization-industry-playbook-evidence"
import { applyPlaybookIndustryBlocksToStrategy } from "@/lib/growth/outreach/personalization/outreach-industry-playbook-blocks"
import { assembleDeterministicOutreachDraft } from "@/lib/growth/outreach/personalization/assemble-draft"
import type { OutreachContextPacket, SelectedMessageBlock } from "@/lib/growth/outreach/personalization/personalization-types"
import { buildPersonalizedSmsDraft } from "@/lib/growth/sms/personalization/assemble-sms-draft"
import {
  buildGrowthIndustryContext,
  buildGrowthPlaybookContext,
  buildIndustryContextEmailParagraphs,
  buildIndustryContextSmsDraft,
} from "@/lib/growth/playbooks/growth-industry-context"
import { buildIndustryContextPromptBlock } from "@/lib/growth/playbooks/growth-industry-context-prompts"
import { GROWTH_PLAYBOOK_CONTEXT_QA_MARKER } from "@/lib/growth/playbooks/context/growth-playbook-context-builder"
import { selectGrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-selection-engine"
import { GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS } from "@/lib/growth/playbooks/playbooks/enriched/priority-playbooks"

const CERT_SECTION = process.env.GS_PLAYBOOK_2B_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

const sterlingVerified = [
  "provides field service and biomedical support for medical equipment organizations",
]

function buildSterlingContext(signals?: {
  hiringSignals?: string[]
  researchSignals?: string[]
  decisionMakerTitle?: string
}) {
  return buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    description: "Field service and biomedical support provider",
    naics: ["621999"],
    verifiedFacts: sterlingVerified,
    hiringSignals: signals?.hiringSignals ?? ["Hiring biomedical field technicians"],
    researchSignals: signals?.researchSignals ?? ["PM compliance tracking for patient-connected devices"],
    decisionMakerTitle: signals?.decisionMakerTitle ?? "Compliance Manager",
    regenerationFeedback: {
      category: "too_generic",
      customNotes: "Lead with industry context then verified facts.",
    },
  })
}

function runSelectionEngineCert(): void {
  const playbook = GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.biomedical_equipment()
  const pmSelection = selectGrowthPlaybookContext({
    playbook,
    industryId: "biomedical_equipment",
    researchSignals: ["PM due dates and preventive maintenance compliance"],
  })
  assert(pmSelection.activeThemes.includes("pm"), `Expected PM theme: ${pmSelection.activeThemes.join(",")}`)
  assert(
    pmSelection.selectedPains.some((pain) => /pm|preventive|maintenance/i.test(pain)),
    `Expected PM pain selected: ${pmSelection.selectedPains.join(" | ")}`,
  )

  const complianceSelection = selectGrowthPlaybookContext({
    playbook,
    industryId: "biomedical_equipment",
    researchSignals: ["FDA recall documentation and audit readiness"],
    decisionMakerTitle: "Compliance Manager",
  })
  assert(complianceSelection.activeThemes.includes("compliance"))
  assert(
    /compliance|htm|clinical engineering|biomed/i.test(complianceSelection.primaryPersona?.title ?? ""),
    `Expected compliance persona: ${complianceSelection.primaryPersona?.title}`,
  )

  const hiringSelection = selectGrowthPlaybookContext({
    playbook: GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.commercial_hvac(),
    industryId: "commercial_hvac",
    hiringSignals: ["Hiring HVAC technicians for seasonal dispatch capacity"],
  })
  assert(hiringSelection.activeThemes.includes("scaling") || hiringSelection.activeThemes.includes("dispatch"))
  console.log("✓ selection engine — theme-aware pains/personas")
}

function runContextBuilderCert(): void {
  assert.equal(GROWTH_PLAYBOOK_CONTEXT_QA_MARKER, "growth-playbook-context-gs-ai-playbook-2b-v1")
  const context = buildSterlingContext()
  assert(context.playbookContext, "playbookContext expected")
  assert.equal(context.playbookContext!.selectedPains.length, 3)
  assert.equal(context.playbookContext!.selectedCapabilities.length, 3)
  assert(context.playbookContext!.primaryCta, "primary CTA expected")
  assert(context.playbookContext!.rankedCtas.length >= 2, "ranked CTAs expected")
  assert.equal(context.discoveryQuestions.length, 3)
  assert.equal(context.recommendedCtas.length, 3)
  assert(context.industryFacts.every((fact) => /often/i.test(fact)))
  console.log("✓ context builder — playbookContext wired into GrowthIndustryContext")
}

function runPersonaCert(): void {
  const fieldPlaybook = GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.field_service()
  const dispatch = selectGrowthPlaybookContext({
    playbook: fieldPlaybook,
    industryId: "field_service",
    leadSignals: ["dispatch board and technician routing"],
    decisionMakerTitle: "Service Manager",
  })
  assert(dispatch.primaryPersona, "primary persona expected")
  assert(/service|dispatch|field|operations/i.test(dispatch.primaryPersona!.title))

  const playbook = GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.biomedical_equipment()
  const executive = selectGrowthPlaybookContext({
    playbook,
    industryId: "biomedical_equipment",
    decisionMakerTitle: "Operations Director",
  })
  assert(/owner|operations|director|general manager|htm/i.test(executive.primaryPersona?.title ?? ""))
  console.log("✓ persona selection — dispatch vs executive routing")
}

function runCtaCert(): void {
  const playbook = GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.commercial_hvac()
  const selection = selectGrowthPlaybookContext({
    playbook,
    industryId: "commercial_hvac",
    researchSignals: ["maintenance contract workflow review"],
  })
  const ranked = selection.rankedCtas
  assert.equal(ranked[0]?.rank, "primary")
  assert(ranked[0]?.cta.length > 10)
  assert(["consultative", "workflow", "demo", "general"].includes(ranked[0]!.style))
  console.log("✓ CTA ranking — primary/secondary/tertiary")
}

function runStorylineCert(): void {
  const playbook = GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.field_service()
  const selection = selectGrowthPlaybookContext({
    playbook,
    industryId: "field_service",
    researchSignals: ["revenue leakage from delayed invoicing"],
  })
  assert(selection.rankedStorylines.length <= 3)
  const categories = new Set(selection.rankedStorylines.map((entry) => entry.category))
  assert(categories.size >= 1)
  console.log("✓ storyline ranking — max 3 categorized storylines")
}

function runOutreachV2Cert(): void {
  const context = buildSterlingContext({ researchSignals: ["PM compliance and recall documentation"] })
  const packet: OutreachContextPacket = {
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    website: null,
    employeeSize: "51-200",
    location: null,
    decisionMakerName: "Jordan Lee",
    decisionMakerTitle: "Compliance Manager",
    fitScore: 72,
    engagementScore: null,
    opportunityReadinessTier: null,
    buyingIntent: null,
    competitorPressure: null,
    capacitySignals: [],
    websiteSummary: null,
    websiteTextExcerpt: null,
    websiteFindings: [],
    hiringSignals: [],
    enrichmentFindings: [],
    researchRecommendedNextAction: null,
    priorTouchSummaries: [],
    priorReplySummaries: [],
    objectionSummaries: [],
    sequenceHistorySummaries: [],
    timelineEventSummaries: [],
    researchConfidence: null,
    researchPainPoints: ["Sterling Biomedical struggles with dispatch"],
    equipmentServiceIndicators: sterlingVerified,
    companySummary: null,
    outreachAngles: [],
    priorOutboundSubjects: [],
    priorTouchCount: 0,
    hasWebsiteResearch: false,
    hasDecisionMaker: true,
    memoryAvailable: false,
    memoryCoverageScore: null,
    relationshipStage: null,
    relationshipSummary: null,
    memoryPreferenceSummaries: [],
    memoryInteractionSummaries: [],
    memoryCommitmentSummaries: [],
    memoryAvoidRepeating: [],
    memoryRiskFlags: [],
    memoryCommitteeSummaries: [],
    memoryOpenLoopSummaries: [],
    memoryEngagementTrend: null,
    memoryProgressionScore: null,
    memoryUnresolvedObjectionCount: 0,
    leadEngineGuidance: null,
    industryContext: context,
  }

  const blocks: SelectedMessageBlock[] = [
    { key: "opening", blockId: "opening_direct", label: "Direct", text: "Hi there regarding Sterling Biomedical." },
    { key: "pain", blockId: "pain_old", label: "Pain", text: "Generic pain." },
    { key: "industry", blockId: "industry_old", label: "Industry", text: "Generic industry." },
    { key: "proof", blockId: "proof_old", label: "Proof", text: "Generic proof." },
    { key: "cta", blockId: "cta_old", label: "CTA", text: "Quick call?" },
  ]
  const applied = applyPlaybookIndustryBlocksToStrategy({
    blocks,
    context,
    packet,
    usedMemoryOpener: false,
    usedResearchOpener: false,
  })
  const draft = assembleDeterministicOutreachDraft({
    strategy: { blocks: applied } as never,
    subject: "Sterling Biomedical workflow",
    maxWords: 120,
  })
  assert(/often/i.test(draft.body))
  assert(/We noticed Sterling Biomedical/i.test(draft.body))
  assert(!/Sterling Biomedical struggles/i.test(draft.body))
  console.log("✓ outreach v2 — selected context in email draft")
}

function runEvidenceCert(): void {
  const bundle = buildIndustryPlaybookEvidenceBundle({
    leadLabel: "Sterling Biomedical",
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
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
    companySignals: sterlingVerified,
    inboxHistory: [],
    sequenceHistory: [],
    templateOverlay: null,
    sourcesUsed: [],
    companySummary: null,
    outreachAngles: [],
    researchPainPoints: ["PM compliance tracking"],
    hiringSignals: ["Hiring HTM technicians"],
    researchConfidence: null,
    companyDescription: "Biomedical field service",
    naicsCodes: ["621999"],
    sicCodes: [],
  })
  assert(bundle.candidates.length >= 4)
  assert(bundle.diagnostics?.addedEvidenceLabels.some((label) => /pm|maintenance|compliance/i.test(label)))
  console.log("✓ evidence generation — signal-aware playbook evidence")
}

function runSendrCert(): void {
  const context = buildSterlingContext()
  const prompt = buildIndustryContextPromptBlock(context)
  assert(prompt.includes("Primary buyer persona"))
  assert(prompt.includes("Discovery angles"))
  assert(prompt.includes("Selection themes"))
  console.log("✓ Sendr context — enriched prompt sections")
}

function runShareCert(): void {
  const context = buildSterlingContext()
  const prompt = buildIndustryContextPromptBlock(context)
  assert(prompt.includes("Verified company facts"))
  assert(prompt.includes("Industry vocabulary"))
  console.log("✓ Share context — enriched prompt sections")
}

function runRegressionCert(): void {
  const context = buildSterlingContext()
  const sms = buildIndustryContextSmsDraft(context)
  assert(sms)
  const voice = generateApolloVoiceDropScriptFromIndustryContext({
    script_type: "biomedical_specific",
    full_name: "Jordan Lee",
    company_name: "Sterling Biomedical",
    industryContext: context,
  })
  assert(voice.full_script.length > 40)
  const paragraphs = buildIndustryContextEmailParagraphs(context, "Sterling Biomedical")
  assert(paragraphs.industryParagraph)
  console.log("✓ regression — SMS/voice/email still pass with selection layer")
}

function main(): void {
  if (section("selection")) runSelectionEngineCert()
  if (section("builder")) runContextBuilderCert()
  if (section("persona")) runPersonaCert()
  if (section("cta")) runCtaCert()
  if (section("storyline")) runStorylineCert()
  if (section("outreach")) runOutreachV2Cert()
  if (section("evidence")) runEvidenceCert()
  if (section("sendr")) runSendrCert()
  if (section("share")) runShareCert()
  if (section("regression")) runRegressionCert()

  console.log("\nGS-AI-PLAYBOOK-2B certification passed")
  console.log("QA:", GROWTH_PLAYBOOK_CONTEXT_QA_MARKER)
}

main()
