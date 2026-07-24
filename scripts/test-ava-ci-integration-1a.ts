/**
 * AVA-COMPANY-INTELLIGENCE-INTEGRATION-1A — Focused certification (no GPT).
 * Run: pnpm test:ava-ci-integration-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  AVA_CI_INTEGRATION_1A_QA_MARKER,
  AVA_GROWTH_ROLE_KNOWLEDGE_V1,
  buildAvaReasoningSystemPrompt,
  buildAvaReasoningUserPrompt,
  enforceAvaReasoningEmailPolicy,
  runAvaReasoning,
} from "../lib/fuzor/ava-reasoning"
import {
  EQUIPIFY_AVA_DEPLOYMENT_OBJECTIVE,
  projectEquipifyKnowledgeBase,
} from "../lib/growth/ava-reasoning/equipify-ava-reasoning-adapter"
import {
  AVA_LEGACY_INTERPRETATION_AUDIT,
  modulesToBypassImmediately,
} from "../lib/growth/ava-reasoning/ava-legacy-interpretation-audit"
import type { CompanyIntelligenceForAiEmployee } from "../lib/fuzor/company-intelligence"
import type { GrowthOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function sampleCi(): CompanyIntelligenceForAiEmployee {
  return {
    ownerOrganizationId: "00757488-1026-44a5-aac4-269533ac21be",
    aiDeploymentId: null,
    companyId: "3e393c05-24ee-4022-a9f7-98aebe6c524f",
    externalCompanyId: "3e393c05-24ee-4022-a9f7-98aebe6c524f",
    leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3",
    companyName: "Block Imaging",
    website: "https://blockimaging.com",
    companyIntelligenceVersionId: "be87fb16-99f5-4e4d-aa98-2033ed204953",
    companyIntelligenceVersion: "fuzor-ci-2a-v1",
    evidenceFingerprint: "4761b5c6cedf5a2fc29f7b7ff3ade706",
    createdAt: new Date().toISOString(),
    understanding: {
      executiveSummary: "Diagnostic imaging equipment and multi-vendor service partner.",
      revenueModel: { summary: "Not confirmed", models: [], evidence: [] },
      productsAndServices: {
        offerings: ["Multi-Vendor Service", "Imaging Parts"],
        notes: null,
        evidence: [],
      },
      operationalModel: { summary: "Multi-vendor service", characteristics: [], evidence: [] },
      customers: { summary: "Health care providers", segments: ["Health care"], evidence: [] },
      industriesServed: { industries: ["Health care"], evidence: [] },
      operationalChallenges: { challenges: [] },
      companyStrengths: { strengths: ["Multi-vendor"], evidence: [] },
      unknowns: [],
      evidenceUsed: ["Verified description"],
      evidenceWeakness: null,
    },
    evidenceRefs: {
      leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3",
      website: "https://blockimaging.com",
      linkedinCompanyUrl: null,
      hasVerifiedDescription: true,
      verifiedOfferingCount: 2,
      verifiedIndustryCount: 0,
      websiteExcerptCount: 1,
      pagesObserved: [],
      datamoonFindingCount: 0,
      missingFromCollection: [],
      priorResearchNotesPresent: false,
    },
  }
}

function sampleSellerTruth(): GrowthOutreachSellerTruth {
  return {
    source: "approved_business_profile",
    profileId: "profile-1",
    sellerCompanyName: "Equipify",
    companyIdentity: "Field operations software for equipment service businesses.",
    productsServices: ["Field service operations", "Equipment lifecycle tools"],
    primaryValueProposition: "Run equipment service operations with less chaos.",
    elevatorPitch: "Equipify helps equipment-centric service businesses operate and grow.",
    idealCustomerProfile: ["Equipment service companies", "Field-operation businesses"],
    disqualifiers: ["Pure retail consumer electronics with no service ops"],
    industries: ["Equipment service"],
    differentiators: ["Built for equipment-centric ops"],
    positioning: ["Operational software for service businesses"],
    mission: null,
    vision: null,
    salesPhilosophy: [],
    discoveryQuestions: [],
    objections: [],
    ctaPreferences: [],
    messagingAngles: ["reduce downtime", "operational clarity"],
    wordsToAvoid: ["revolutionize"],
    neverSay: [],
    competitiveNotes: [],
    businessOutcomes: ["Fewer missed jobs", "Clearer technician utilization"],
    tonePreference: null,
    enrichments: {
      fromBusinessIntelligence: [],
      fromOrganizationalKnowledge: [],
      fromKnowledgeCenter: [],
      fromIndustryPlaybook: [],
    },
    industryPlaybookUsedAsFallback: false,
    biUsedAsEnrichmentOnly: false,
    limitations: ["Not a CRM replacement for enterprise sales orgs"],
    whenNotToRecommend: ["No field or equipment service motion"],
    proofPoints: [],
  }
}

async function main(): Promise<void> {
  console.log(`[${AVA_CI_INTEGRATION_1A_QA_MARKER}] focused certification`)

  // Route now uses supervised cutover (AVA-SUPERVISED-CUTOVER-1A).
  assert.match(
    readSource("app/api/platform/growth/leads/[leadId]/ava-direct-outreach/route.ts"),
    /runEquipifySupervisedAvaOutreach/,
  )

  // Reusable core has no Equipify business facts.
  const serviceSrc = readSource("lib/fuzor/ava-reasoning/ava-reasoning-service.ts")
  assert.doesNotMatch(serviceSrc, /Equipify helps|sell Equipify|Blitz Industries/)
  assert.match(serviceSrc, /runAvaReasoning/)

  const roleSrc = readSource("lib/fuzor/ava-reasoning/ava-role-knowledge.ts")
  assert.doesNotMatch(roleSrc, /sell Equipify|Blitz Industries sell/)
  assert.match(roleSrc, /consultative growth operator/i)
  assert.ok(!JSON.stringify(AVA_GROWTH_ROLE_KNOWLEDGE_V1).includes("Equipify"))

  const promptSrc = readSource("lib/fuzor/ava-reasoning/ava-reasoning-prompts.ts")
  assert.doesNotMatch(promptSrc, /Equipify|industry scores|website maturity|pain-signal/i)

  // Adapter holds Equipify objective + KB projection.
  assert.match(EQUIPIFY_AVA_DEPLOYMENT_OBJECTIVE, /sell Equipify/)
  const kb = projectEquipifyKnowledgeBase(sampleSellerTruth())
  assert.equal(kb.organizationName, "Equipify")
  assert.ok(kb.productsAndCapabilities.length > 0)
  assert.ok(kb.disqualifiers.length > 0)

  // Email policy.
  assert.equal(
    enforceAvaReasoningEmailPolicy({
      decision: "hold",
      rationale: "thin",
      strongestAngle: null,
      recommendedContact: null,
      missingInformation: ["description"],
      email: { subject: "x", body: "y" },
      evidenceReferences: [],
    }).email,
    null,
  )

  // Prompt contains CI + org knowledge + objective, not legacy scores.
  const userPrompt = buildAvaReasoningUserPrompt({
    ownerOrganizationId: "org",
    companyIntelligence: sampleCi(),
    organizationKnowledge: kb,
    roleKnowledge: AVA_GROWTH_ROLE_KNOWLEDGE_V1,
    objective: EQUIPIFY_AVA_DEPLOYMENT_OBJECTIVE,
    contacts: [],
    hardRuleState: {
      outboundSendAuthorized: false,
      draftGenerationAllowed: true,
      optOutBlocked: false,
      suppressed: false,
      persistenceEnabled: false,
    },
    actingUserEmail: "proof@equipify.local",
  })
  assert.match(userPrompt, /CANONICAL COMPANY INTELLIGENCE/)
  assert.match(userPrompt, /ORGANIZATION KNOWLEDGE BASE/)
  assert.match(userPrompt, /CURRENT OBJECTIVE/)
  assert.doesNotMatch(userPrompt, /website maturity|pain signal|qualification score/i)

  const systemPrompt = buildAvaReasoningSystemPrompt(AVA_GROWTH_ROLE_KNOWLEDGE_V1)
  assert.match(systemPrompt, /genuinely justified/i)
  assert.match(systemPrompt, /NOT a reason to hold/)
  assert.doesNotMatch(systemPrompt, /Equipify/)

  // Mocked reasoning path.
  const mocked = await runAvaReasoning({
    ownerOrganizationId: "00757488-1026-44a5-aac4-269533ac21be",
    companyIntelligence: sampleCi(),
    organizationKnowledge: kb,
    roleKnowledge: AVA_GROWTH_ROLE_KNOWLEDGE_V1,
    objective: EQUIPIFY_AVA_DEPLOYMENT_OBJECTIVE,
    contacts: [
      {
        contactId: "dm-1",
        name: "Alex Example",
        title: "VP Operations",
        role: "VP Operations",
        email: "alex@example.com",
        linkedinUrl: null,
        companyAssociation: "Block Imaging",
        professionalSummary: null,
        contactabilityStatus: "contactable",
        evidenceSource: "manual",
        evidenceExcerpt: null,
      },
    ],
    hardRuleState: {
      outboundSendAuthorized: false,
      draftGenerationAllowed: true,
      optOutBlocked: false,
      suppressed: false,
      persistenceEnabled: false,
    },
    actingUserEmail: "proof@equipify.local",
    runModel: async () => ({
      result: {
        decision: "pursue",
        rationale: "Clear equipment-service fit.",
        strongestAngle: "Multi-vendor imaging service ops",
        recommendedContact: {
          contactId: "dm-1",
          name: "Alex Example",
          title: "VP Operations",
          reason: "Operations leadership",
        },
        missingInformation: [],
        email: {
          subject: "Quick question on multi-vendor imaging ops",
          body: "Alex — …",
        },
        evidenceReferences: ["CI executiveSummary", "contact dm-1"],
      },
      provider: "mock",
      model: "gpt-5.5",
      attempts: 1,
      durationMs: 1,
      promptTokens: 10,
      completionTokens: 10,
    }),
  })
  assert.equal(mocked.ok, true)
  if (mocked.ok) {
    assert.equal(mocked.output.result.decision, "pursue")
    assert.equal(mocked.output.persistenceStatus, "disabled")
    assert.equal(mocked.output.outboundSendAuthorized, false)
  }

  assert.ok(AVA_LEGACY_INTERPRETATION_AUDIT.length >= 15)
  assert.ok(modulesToBypassImmediately().length >= 5)

  // Consumes platform CI package, not storage tables directly from Ava service.
  const adapterSrc = readSource("lib/growth/ava-reasoning/equipify-ava-reasoning-adapter.ts")
  assert.match(adapterSrc, /ensureCompanyIntelligenceForGrowthLead/)
  assert.doesNotMatch(adapterSrc, /fuzor_company_intelligence_versions/)
  assert.doesNotMatch(adapterSrc, /from\("company_intelligence_runs"\)/)

  console.log(`[${AVA_CI_INTEGRATION_1A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
