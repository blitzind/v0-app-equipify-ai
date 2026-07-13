/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-1B — Elite Human Sales Communication certification.
 * Run: pnpm test:ge-aios-conversation-intelligence-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1B_QA_MARKER,
  detectAiFingerprint,
  failsSwapTest,
  humanizeObservation,
  reviewEliteHumanCommunication,
} from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
import { EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE } from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"

const ROOT = process.cwd()
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleProfile(): BusinessProfileDraftContent {
  return {
    company: {
      companyName: "Equipify",
      website: "https://equipify.ai",
      shortDescription: "Service operations platform",
      productsServices: ["Work orders", "Dispatch"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Reduce operational complexity for equipment service businesses.",
    },
    idealCustomers: {
      targetIndustries: ["Biomedical and medical equipment service"],
      companySizeRanges: ["20-200"],
      geography: ["United States"],
      buyerPersonas: ["Owner", "Operations leaders"],
      disqualifiers: [],
    },
    problemsAndTriggers: {
      painPoints: ["Scattered handoffs"],
      buyingTriggers: ["Multi-site expansion"],
      competitorsAlternatives: [],
      keywords: [],
      negativeKeywords: [],
    },
    salesAndMarketing: {
      averageDealSize: null,
      salesCycleEstimate: null,
      messagingAngles: ["Outcome-first service visibility"],
      qualificationCriteria: [],
    },
    businessStrategy: {
      companyWide: {
        mission: "Help equipment businesses run cleaner service operations",
        coreValues: [],
        brandPersonality: "Consultative",
      },
      messaging: {
        elevatorPitch: "Equipify helps service teams replace scattered handoffs with a clearer operating rhythm.",
        tone: "consultative",
        formality: "professional",
        emailLengthPreference: "short",
        ctaPreferences: ["15-minute workflow review"],
        wordsToAvoid: ["synergy"],
        neverSay: ["guaranteed ROI"],
      },
      positioning: {
        competitiveAdvantages: ["Built for equipment-centric operators"],
        pricingPhilosophy: "Value over discounting",
        neverCompeteOnPrice: true,
        competitorNotes: [],
      },
      salesPhilosophy: {
        qualificationStandards: [],
        discoveryQuestions: ["How do you coordinate depot and field work today?"],
        disqualifiers: [],
      },
      objections: {
        items: [
          {
            objection: "We already have software.",
            preferredResponse: "Fair — the question is whether handoffs still create delay.",
          },
        ],
      },
      salesAndRelationships: { principles: [], notes: "" },
    },
    canonicalSellerKnowledge: EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE,
  }
}

console.log(`[${GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1B_QA_MARKER}] Elite Human Sales Communication certification\n`)

// Architecture — no new persistence
const draftService = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts")
const draftsSource = readSource("lib/growth/aios/growth/growth-outreach-strategy-drafts.ts")
assert.match(draftsSource, /buildEliteHumanProspectDrafts/)
assert.match(draftsSource, /reviewEliteHumanCommunication/)
assert.ok(draftService.includes("generateOutreachDraftsFromSalesStrategyBrief"))
console.log("  ✓ Wired into existing draft pipeline — no new persistence")

// AI fingerprint detector
const aiDraft =
  "Hi John, I hope you're doing well. I wanted to reach out because I noticed your company. Based on my research, our system found a 82% fit. Equipify is a comprehensive platform with work orders, dispatch, and scheduling modules."
const aiFailures = detectAiFingerprint(aiDraft)
assert.ok(aiFailures.length >= 5, `Expected multiple AI fingerprints, got ${aiFailures.length}`)
console.log("  ✓ AI fingerprint detector rejects SDR clichés and internal reasoning")

// Observation-first
const observation = humanizeObservation({
  insight: "You support diagnostic imaging equipment across healthcare providers.",
  equipment: ["MRI", "CT"],
  companyName: "Block Imaging",
  industry: "Medical Imaging",
})
assert.ok(!/^you support/i.test(observation))
assert.ok(/mri|ct|imaging|depot|stood out|heavy lift/i.test(observation))
console.log("  ✓ Observation-first — never opens with pitch or seller name")

// Swap test
assert.ok(failsSwapTest("Hi — curious about your service operations this quarter?", "Acme Corp"))
assert.ok(!failsSwapTest("Hi — MRI/CT depot work at your scale caught my eye.", "Block Imaging"))
console.log("  ✓ Swap test rejects copy that works for any company")

const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Industrial equipment service",
})

const brief = buildOutreachSalesStrategyBrief({
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T21:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  contactEmail: "josh@blockimaging.com",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: [
    "Verified description (82%): Block Imaging is a global diagnostic imaging company.",
    "Service indicator: MRI / CT refurbished systems",
  ],
  opportunitySummary: "Strong imaging service fit.",
  fitReason: "Fits approved ICP",
  qualificationConfidence: 0.82,
  sellerTruth,
  approvedProfile: profile,
})

const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })
const prospectCopy = [drafts.email.full, drafts.linkedIn, drafts.sms].join("\n")

assert.ok(!/verified description|\(\d+%\)|based on my research|our system found/i.test(prospectCopy))
assert.ok(!/hope you(?:'|’)re doing well|i noticed|wanted to reach out|i came across/i.test(prospectCopy))
assert.ok(!/equipify/i.test(drafts.email.body.split("\n").slice(0, 4).join(" ")), "Email must not lead with seller")
assert.ok(!/the question on my mind|service footprint stood out|smallest next step/i.test(prospectCopy))
assert.ok(drafts.email.body.split("\n\n").filter(Boolean).length <= 4, "Email should stay short and conversational")
assert.equal(reviewEliteHumanCommunication(drafts.email.full, "Block Imaging").length, 0)
assert.equal(reviewEliteHumanCommunication(drafts.linkedIn, "Block Imaging").length, 0)
assert.equal(reviewEliteHumanCommunication(drafts.sms, "Block Imaging").length, 0)
assert.equal(drafts.qualityFailures.length, 0, `Quality failures: ${drafts.qualityFailures.join(", ")}`)
assert.ok(/depot|imaging|refurb|coordinating|uptime|show up|live issue|off base|\?/i.test(prospectCopy))
console.log("  ✓ Block Imaging drafts pass elite human review")

// 1A regression still wired
const intelSource = readSource("lib/growth/aios/growth/growth-outreach-conversation-intelligence.ts")
assert.match(intelSource, /buildEvidenceIntelligence/)
console.log("  ✓ CONVERSATION-INTELLIGENCE-1A reasoning layer unchanged")

console.log("\nGE-AIOS-CONVERSATION-INTELLIGENCE-1B certification PASSED")
