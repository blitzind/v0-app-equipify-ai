/**
 * GS-AI-PLAYBOOK-1C certification — Stack B industry playbook outreach integration.
 * Run: pnpm test:growth-playbook-outreach-context (and sibling aliases)
 */

import assert from "node:assert/strict"
import { generateApolloVoiceDropScriptFromIndustryContext } from "@/lib/growth/apollo/apollo-voice-drop-script-generation"
import {
  buildAllowedFactsFromContextPacket,
  buildIndustryFactsFromContextPacket,
  buildVerifiedFactsFromContextPacket,
} from "@/lib/growth/outreach/personalization/allowed-facts-from-context-packet"
import { buildOutreachRefinementUserPrompt } from "@/lib/growth/outreach/personalization/ai-refinement-prompts"
import { applyPlaybookIndustryBlocksToStrategy } from "@/lib/growth/outreach/personalization/outreach-industry-playbook-blocks"
import { buildOutreachVerifiedFactsFromPacket } from "@/lib/growth/outreach/personalization/outreach-verified-facts"
import { assembleDeterministicOutreachDraft } from "@/lib/growth/outreach/personalization/assemble-draft"
import type { OutreachContextPacket, SelectedMessageBlock } from "@/lib/growth/outreach/personalization/personalization-types"
import { buildPersonalizedSmsDraft } from "@/lib/growth/sms/personalization/assemble-sms-draft"
import {
  buildGrowthIndustryContext,
  buildIndustryContextEmailParagraphs,
  buildIndustryContextSmsDraft,
  buildRegenerationFeedbackDirectives,
  deriveLeadIndustryTagsFromContext,
  GROWTH_INDUSTRY_CONTEXT_QA_MARKER,
} from "@/lib/growth/playbooks/growth-industry-context"
import { buildIndustryContextPromptBlock } from "@/lib/growth/playbooks/growth-industry-context-prompts"

const CERT_SECTION = process.env.GS_PLAYBOOK_1C_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

function assertNoGenericSterling(body: string): void {
  assert(!/Hi there regarding Sterling Biomedical/i.test(body), `Generic opener detected: ${body}`)
  assert(!/Sterling Biomedical struggles with/i.test(body), `Unverified company pain: ${body}`)
}

const sterlingVerified = [
  "provides field service and biomedical support for medical equipment organizations",
]

function buildSterlingContext() {
  return buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    description: "Field service and biomedical support provider",
    naics: ["621999"],
    verifiedFacts: sterlingVerified,
    regenerationFeedback: {
      category: "too_generic",
      customNotes: "Lead with industry context then verified facts.",
    },
  })
}

function minimalPacket(context: ReturnType<typeof buildSterlingContext>): OutreachContextPacket {
  return {
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    website: null,
    employeeSize: null,
    location: null,
    decisionMakerName: "Jordan Lee",
    decisionMakerTitle: "Operations Director",
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
    researchPainPoints: ["Sterling Biomedical struggles with dispatch"], // must NOT leak
    equipmentServiceIndicators: ["field service and biomedical support for medical equipment organizations"],
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
}

function runContextCert(): void {
  const context = buildSterlingContext()
  assert.equal(context.industryId, "biomedical_equipment")
  assert(context.playbookApplied, "playbook should apply for biomedical NAICS")
  assert(context.verifiedFacts.every((fact) => !fact.startsWith("Teams in")), "verified facts must not be industry facts")
  assert(context.industryFacts.every((fact) => /often/i.test(fact)), "industry facts use 'often' framing")
  assert(context.industryFacts.every((fact) => !fact.includes("Sterling")), "industry facts must not name company")
  assert(context.leadIndustryTags.includes("biomedical_equipment"), "leadIndustryTags populated")
  assert.equal(GROWTH_INDUSTRY_CONTEXT_QA_MARKER, "growth-industry-context-gs-ai-playbook-1c-v1")
  console.log("✓ context builder — verified vs industry separation")
}

function runEmailCert(): void {
  const context = buildSterlingContext()
  const packet = minimalPacket(context)
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
  assertNoGenericSterling(draft.body)
  assert(/often/i.test(draft.body), `Expected industry context: ${draft.body}`)
  assert(/We noticed Sterling Biomedical/i.test(draft.body), `Expected verified company line: ${draft.body}`)
  assert(/Many teams centralize|Teams often centralize/i.test(draft.body), `Expected neutral capability mapping: ${draft.body}`)

  const allowed = buildAllowedFactsFromContextPacket(packet)
  assert(!allowed.some((fact) => /Sterling Biomedical struggles/i.test(fact)), "research pain must not be allowed fact")

  const prompt = buildOutreachRefinementUserPrompt({
    draft,
    blocks: applied,
    allowedFacts: allowed,
    industryContext: context,
    maxWords: 120,
  })
  assert(prompt.includes("regenerationFeedbackDirectives"), "regeneration feedback consumed in prompt")
  console.log("✓ email generation — industry-aware draft")
  console.log("  before: Hi there regarding Sterling Biomedical...")
  console.log(`  after:  ${draft.body.slice(0, 220)}…`)
}

function runSmsCert(): void {
  const context = buildSterlingContext()
  const packet = minimalPacket(context)
  const sms = buildIndustryContextSmsDraft(context)
  assert(sms, "SMS draft expected")
  assert(/often struggle/i.test(sms!), sms!)
  assert(!/Sterling Biomedical struggles/i.test(sms!), sms!)
  assert(/Teams often centralize|Many teams centralize/i.test(sms!), sms!)

  const built = buildPersonalizedSmsDraft({
    leadId: "lead-sterling",
    context: { packet, priorSmsCount: 0, priorSmsPreviews: [], shortForm: true },
    messageType: "cold_sms",
  })
  assert.equal(built.audit.openingHook.strategy, "industry_playbook")
  console.log("✓ SMS generation — industry pain + capability + soft CTA")
}

function runVoiceCert(): void {
  const context = buildSterlingContext()
  const script = generateApolloVoiceDropScriptFromIndustryContext({
    script_type: "biomedical_specific",
    full_name: "Jordan Lee",
    company_name: "Sterling Biomedical",
    industryContext: context,
  })
  assert(script.full_script.length > 40, "voice script generated")
  assert(!/Sterling Biomedical struggles/i.test(script.full_script), "no hallucinated pain")
  assert(/Teams in|often/i.test(script.full_script), "industry challenge present")
  console.log("✓ voice generation — hook + industry + capability + CTA")
}

async function runCopilotRulesCert(): Promise<void> {
  const context = buildSterlingContext()
  const tags = deriveLeadIndustryTagsFromContext(context)
  assert(tags.includes("biomedical_equipment"), `missing industry id tag: ${tags.join(",")}`)
  assert(tags.some((tag) => tag.includes("biomed")), `missing alias tag: ${tags.join(",")}`)
  const haystack = new Set(tags.map((tag) => tag.toLowerCase()))
  const scopeMatches = ["biomedical_equipment", "biomed"].some((tag) => haystack.has(tag))
  assert(scopeMatches, "resolver industry scope would match populated leadIndustryTags")
  console.log("✓ copilot rules — leadIndustryTags populated for resolver")
}

function runSendrCert(): void {
  const context = buildSterlingContext()
  const prompt = buildIndustryContextPromptBlock(context)
  assert(prompt.includes("Industry playbook:"), prompt)
  assert(/Verified Company Facts/i.test(prompt), prompt)
  assert(/Teams in this space often/i.test(prompt), prompt)
  console.log("✓ Sendr AI prompt — industry context block")
}

function runShareCert(): void {
  const context = buildSterlingContext()
  const prompt = buildIndustryContextPromptBlock(context)
  assert(/Verified Company Facts|why reaching out/i.test(prompt), prompt)
  console.log("✓ Share page AI prompt — industry-aware sections")
}

function runRegenerationFeedbackCert(): void {
  const directives = buildRegenerationFeedbackDirectives({
    category: "wrong_industry_assumptions",
    customNotes: "Biomedical only — avoid HVAC assumptions.",
  })
  assert(directives.some((entry) => /low-confidence/i.test(entry)), directives.join("|"))
  assert(directives.some((entry) => /Biomedical only/i.test(entry)), directives.join("|"))
  console.log("✓ regeneration feedback — prompt directives only")
}

async function main(): Promise<void> {
  if (section("context") || CERT_SECTION === "all") runContextCert()
  if (section("email") || CERT_SECTION === "all") runEmailCert()
  if (section("sms") || CERT_SECTION === "all") runSmsCert()
  if (section("voice") || CERT_SECTION === "all") runVoiceCert()
  if (section("copilot") || CERT_SECTION === "all") await runCopilotRulesCert()
  if (section("sendr") || CERT_SECTION === "all") runSendrCert()
  if (section("share") || CERT_SECTION === "all") runShareCert()
  if (section("regeneration") || CERT_SECTION === "all") runRegenerationFeedbackCert()

  const paragraphs = buildIndustryContextEmailParagraphs(buildSterlingContext(), "Sterling Biomedical")
  const verifiedOnly = buildVerifiedFactsFromContextPacket(minimalPacket(buildSterlingContext()))
  const industryOnly = buildIndustryFactsFromContextPacket(minimalPacket(buildSterlingContext()))
  assert(verifiedOnly.length > 0 && industryOnly.length > 0, "packet fact split")
  assert(buildOutreachVerifiedFactsFromPacket(minimalPacket(buildSterlingContext())).length > 0)

  console.log("\nGS-AI-PLAYBOOK-1C certification passed")
  console.log("QA:", GROWTH_INDUSTRY_CONTEXT_QA_MARKER)
  console.log("Sterling industry paragraph:", paragraphs.industryParagraph)
  console.log("Sterling company paragraph:", paragraphs.companyParagraph)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
