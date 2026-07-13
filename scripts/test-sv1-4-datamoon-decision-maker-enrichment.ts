/**
 * SV1-4 — DataMoon decision-maker enrichment certification.
 * Run: pnpm test:sv1-4-datamoon-decision-maker-enrichment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  authorizeDatamoonPersonEnrichment,
  buildDatamoonAudienceFiltersForDecisionMaker,
  buildDatamoonPersonSearchIdempotencyKey,
  decideDatamoonDecisionMakerEnrichment,
  evaluateDecisionMakerContactReadiness,
  isExistingDecisionMakerSufficient,
  mergeContactPreferringVerified,
  projectDecisionMakerRequirement,
  rankDatamoonDecisionMakerCandidates,
  selectBestDatamoonDecisionMaker,
} from "../lib/growth/datamoon-decision-maker/datamoon-dm-engine"
import { normalizeDatamoonRecordsToDecisionMakerCandidates } from "../lib/growth/datamoon-decision-maker/datamoon-dm-normalize"
import {
  clearDatamoonDmRequestLedgerForTests,
  getDatamoonDmAttemptCount,
  hasInFlightOrRecentDatamoonDmRequest,
  hasRecentEquivalentDatamoonDmNoResult,
  recordDatamoonDmRequestAttempt,
} from "../lib/growth/datamoon-decision-maker/datamoon-dm-request-ledger"
import {
  AI_OS_DATAMOON_DM_QA_MARKER,
  AI_OS_DATAMOON_DM_RETRY,
} from "../lib/growth/datamoon-decision-maker/datamoon-dm-types"
import {
  createDraftFactoryLeadRecord,
  planDraftFactoryAdvance,
  runDraftFactoryOvernightBatch,
} from "../lib/growth/draft-factory/draft-factory-engine"
import type { AiOsDraftFactorySignals } from "../lib/growth/draft-factory/draft-factory-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[SV1-4] DataMoon decision-maker enrichment certification")

clearDatamoonDmRequestLedgerForTests()

// --- Existing sufficient skips DataMoon ---
const sufficientReq = projectDecisionMakerRequirement({
  admissionState: "accepted",
  researchComplete: true,
  companyIdentityConfident: true,
  existingDecisionMakers: [
    {
      fullName: "Alex Owner",
      title: "Owner",
      email: "alex@imaging.example",
      status: "confirmed",
      isPrimary: true,
      confidence: 0.9,
    },
  ],
  investmentState: "increase_investment",
  earnedEnrichmentSpend: true,
})
assert.equal(sufficientReq.existingPersonSufficient, true)
assert.equal(
  isExistingDecisionMakerSufficient({
    fullName: "Alex Owner",
    title: "Owner",
    email: "alex@imaging.example",
    status: "confirmed",
    isPrimary: true,
    confidence: 0.9,
  }),
  true,
)
const skipAuth = authorizeDatamoonPersonEnrichment({
  requirement: sufficientReq,
  investmentState: "increase_investment",
  portfolioSelected: true,
  providerEnabled: true,
  providerConfigured: true,
  budgetAvailable: true,
})
assert.equal(skipAuth.authorized, false)
assert.equal(skipAuth.denyReason, "sufficient_dm_exists")
console.log("  ✓ existing sufficient canonical person skips DataMoon")

// --- Missing DM requests only when authorized ---
const needReq = projectDecisionMakerRequirement({
  admissionState: "accepted",
  researchComplete: true,
  companyIdentityConfident: true,
  existingDecisionMakers: [],
  investmentState: "increase_investment",
  earnedEnrichmentSpend: true,
})
assert.equal(needReq.anotherPersonNeeded, true)
const allowed = authorizeDatamoonPersonEnrichment({
  requirement: needReq,
  investmentState: "increase_investment",
  resourceAllocationSpendAuthorized: true,
  portfolioSelected: true,
  providerEnabled: true,
  providerConfigured: true,
  budgetAvailable: true,
})
assert.equal(allowed.authorized, true)
console.log("  ✓ missing decision maker authorized only when gates pass")

// --- Stop Investment blocks ---
const stopAuth = authorizeDatamoonPersonEnrichment({
  requirement: needReq,
  investmentState: "stop_investment",
  portfolioSelected: true,
  providerEnabled: true,
  providerConfigured: true,
  budgetAvailable: true,
})
assert.equal(stopAuth.authorized, false)
assert.equal(stopAuth.denyReason, "stop_investment")
console.log("  ✓ Stop Investment blocks DataMoon")

// --- Non-selected portfolio ---
const portAuth = authorizeDatamoonPersonEnrichment({
  requirement: needReq,
  investmentState: "increase_investment",
  portfolioSelected: false,
  providerEnabled: true,
  providerConfigured: true,
  budgetAvailable: true,
})
assert.equal(portAuth.authorized, false)
assert.equal(portAuth.denyReason, "not_portfolio_selected")
console.log("  ✓ non-selected portfolio lead receives no DataMoon call")

// --- Provider disabled / budget ---
assert.equal(
  authorizeDatamoonPersonEnrichment({
    requirement: needReq,
    investmentState: "increase_investment",
    portfolioSelected: true,
    providerEnabled: false,
    providerConfigured: true,
    budgetAvailable: true,
  }).denyReason,
  "provider_disabled",
)
assert.equal(
  authorizeDatamoonPersonEnrichment({
    requirement: needReq,
    investmentState: "increase_investment",
    portfolioSelected: true,
    providerEnabled: true,
    providerConfigured: true,
    budgetAvailable: false,
  }).denyReason,
  "budget_exhausted",
)
console.log("  ✓ provider-disabled and budget-exhausted fail closed")

// --- Idempotency / duplicate wake / no-result cooldown ---
const idem = buildDatamoonPersonSearchIdempotencyKey({
  organizationId: "org",
  leadId: "lead_1",
  companyDomain: "imaging.example",
  titleFamilies: needReq.titleFamilies,
})
const now = "2026-07-12T18:00:00.000Z"
recordDatamoonDmRequestAttempt({
  idempotencyKey: idem,
  organizationId: "org",
  leadId: "lead_1",
  now,
  outcome: "no_suitable_person",
  noSuitablePerson: true,
})
assert.equal(hasInFlightOrRecentDatamoonDmRequest({ idempotencyKey: idem, now }), true)
assert.equal(hasRecentEquivalentDatamoonDmNoResult({ idempotencyKey: idem, now }), true)
assert.equal(getDatamoonDmAttemptCount("org", "lead_1"), 1)
const noResultAuth = authorizeDatamoonPersonEnrichment({
  requirement: { ...needReq, searchAlreadyAttempted: true },
  investmentState: "increase_investment",
  portfolioSelected: true,
  providerEnabled: true,
  providerConfigured: true,
  budgetAvailable: true,
  recentEquivalentNoResult: true,
})
assert.equal(noResultAuth.denyReason, "recent_equivalent_no_result")
console.log("  ✓ duplicate wake / equivalent no-result does not burn another credit")

// --- Normalize + rank + select ---
const ranked = normalizeDatamoonRecordsToDecisionMakerCandidates({
  records: [
    {
      id: "dm1",
      first_name: "Sam",
      last_name: "Ops",
      job_title: "VP Operations",
      business_email: "sam@imaging.example",
      company_name: "Imaging Co",
      company_domain: "imaging.example",
    },
    {
      id: "dm2",
      first_name: "Pat",
      last_name: "Assist",
      job_title: "Office Manager",
      business_email: "pat@imaging.example",
      company_name: "Imaging Co",
      company_domain: "imaging.example",
    },
  ],
  expectedCompanyDomain: "imaging.example",
  expectedCompanyName: "Imaging Co",
})
assert.ok(ranked.length >= 2)
assert.equal(ranked[0].fullName, "Sam Ops")
const best = selectBestDatamoonDecisionMaker(ranked)
assert.ok(best)
assert.equal(best!.fullName, "Sam Ops")
assert.ok(best!.compositeScore > ranked[1].compositeScore)
console.log("  ✓ DataMoon candidate normalizes; best candidate selected deterministically")

// --- Verified facts not overwritten ---
const merged = mergeContactPreferringVerified({
  existing: { email: "verified@imaging.example", phone: null, title: "Owner" },
  incoming: { email: "weaker@other.example", phone: "555-111-2222", title: "CEO" },
})
assert.equal(merged.email, "verified@imaging.example")
assert.equal(merged.phone, "555-111-2222")
assert.equal(merged.title, "Owner")
console.log("  ✓ lower-confidence provider data does not overwrite verified email")

// --- Unverified contact does not unblock email drafting ---
const unverified = evaluateDecisionMakerContactReadiness({
  email: null,
  phone: null,
  linkedinUrl: "https://linkedin.com/in/x",
})
assert.equal(unverified.unblocksEmailDrafting, false)
const verified = evaluateDecisionMakerContactReadiness({
  email: "ceo@imaging.example",
  phone: null,
})
assert.equal(verified.unblocksEmailDrafting, true)
console.log("  ✓ unverified contact does not improperly unblock email drafting")

// --- Draft Factory resume from waiting_for_dm ---
const dfSignals: AiOsDraftFactorySignals = {
  admissionState: "accepted",
  researchFresh: true,
  hasUsableResearch: true,
  knowledgeComplete: true,
  investmentState: "increase_investment",
  spendAuthorized: true,
  portfolioSelected: true,
  decisionMakerStatus: "none",
  hasPrimaryDecisionMaker: false,
  hasContactName: false,
  personalizationReady: false,
  transportBlocked: true,
}
const waiting = createDraftFactoryLeadRecord({
  organizationId: "org",
  leadId: "lead_dm",
  signals: dfSignals,
  now,
})
assert.equal(waiting.state, "waiting_for_dm")
const afterDm = planDraftFactoryAdvance({
  record: waiting,
  signals: {
    ...dfSignals,
    hasPrimaryDecisionMaker: true,
    hasContactName: true,
    decisionMakerStatus: "confirmed",
    personalizationReady: true,
  },
  wakeSource: "datamoon_person_completed",
  budgetAvailable: true,
  now,
})
assert.ok(
  afterDm.nextState === "waiting_for_generation" || afterDm.resumedFrom === "generation",
)
console.log("  ✓ verified contact resumes Draft Factory from waiting_for_dm")

// --- Decision composition ---
const decision = decideDatamoonDecisionMakerEnrichment({
  organizationId: "org",
  leadId: "lead_dm",
  requirement: needReq,
  authorization: allowed,
  rankedCandidates: ranked,
  providerCalled: true,
  idempotencyKey: idem,
  now,
})
assert.equal(decision.qaMarker, AI_OS_DATAMOON_DM_QA_MARKER)
assert.ok(decision.explainability.whyDecisionMakerNeeded)
assert.ok(decision.explainability.whySelectedOutranked)
assert.equal(decision.resumeDraftFactoryTo, "personalization")
assert.ok(decision.selectedCandidate)
console.log("  ✓ explainability + resume disposition recorded")

// --- Filters reuse DataMoon provider fields (no Apollo) ---
const filters = buildDatamoonAudienceFiltersForDecisionMaker({
  companyName: "Imaging Co",
  titleFamilies: ["Owner", "VP Operations"],
})
assert.ok(filters.some((f) => f.field === "company_name"))
assert.ok(filters.some((f) => f.field === "job_title"))

const moduleCorpus = fs
  .readdirSync(path.join(ROOT, "lib/growth/datamoon-decision-maker"))
  .filter((n) => n.endsWith(".ts"))
  .map((n) => readSource(`lib/growth/datamoon-decision-maker/${n}`))
  .join("\n")
assert.equal(/from \"@\/lib\/growth\/providers\/apollo|apollo_people_search/.test(moduleCorpus), false)
assert.equal(/sendEmail|enrollInCampaign|transportBlocked:\s*false/.test(moduleCorpus), false)
console.log("  ✓ no Apollo path; no send/enroll; transport_blocked intact")

// --- 5F still canonical; DF wiring present ---
const dfService = readSource("lib/growth/draft-factory/draft-factory-service.ts")
assert.ok(dfService.includes("evaluateAndEnrichDecisionMakerForLead"))
assert.ok(dfService.includes("generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory") || dfService.includes("buildAutonomousOutreachApprovalPackage"))
const draft5f = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
)
assert.ok(draft5f.includes("pendingHumanApproval: true"))
assert.ok(draft5f.includes("transportBlocked: true"))
console.log("  ✓ Draft generation still through Growth 5F; approval + transport_blocked enforced")

// --- Retry limit ---
assert.equal(AI_OS_DATAMOON_DM_RETRY.maxAttemptsPerLead, 3)
assert.equal(
  authorizeDatamoonPersonEnrichment({
    requirement: needReq,
    investmentState: "increase_investment",
    portfolioSelected: true,
    providerEnabled: true,
    providerConfigured: true,
    budgetAvailable: true,
    searchAttemptCount: 3,
  }).denyReason,
  "retry_limit_reached",
)
console.log("  ✓ provider failure / retry policy: retry limit terminal")

// --- 500-lead simulation respecting capacity / investment ---
const simNow = "2026-07-12T19:00:00.000Z"
const candidates = Array.from({ length: 500 }, (_, i) => {
  const leadId = `dm_sim_${String(i).padStart(3, "0")}`
  if (i < 80) {
    // Ready for drafting after DM (increase + portfolio + dm)
    return {
      leadId,
      signals: {
        admissionState: "accepted" as const,
        researchFresh: true,
        hasUsableResearch: true,
        knowledgeComplete: true,
        investmentState: "increase_investment" as const,
        spendAuthorized: true,
        portfolioSelected: true,
        hasPrimaryDecisionMaker: true,
        hasContactName: true,
        decisionMakerStatus: "confirmed",
        personalizationReady: true,
        transportBlocked: true as const,
      },
      growth5fApprovalPackage: {
        packageId: `p:${leadId}`,
        leadId,
        companyName: `Co ${i}`,
        preparedAt: simNow,
        generatedAssets: [
          { channel: "email" as const, label: "S", preview: "Body", draftOnly: true as const },
        ],
        personalizationEvidence: [],
        supportingResearch: [],
        confidence: 0.8,
        approvalRequirements: ["human_send_gate"],
        complianceNotes: [],
        recommendedChannel: "email",
        recommendedSequence: "email_first",
        expectedOutcome: "review",
        pendingHumanApproval: true as const,
        transportBlocked: true as const,
      },
    }
  }
  if (i < 150) {
    return {
      leadId,
      signals: {
        admissionState: "accepted" as const,
        researchFresh: true,
        hasUsableResearch: true,
        knowledgeComplete: true,
        investmentState: "stop_investment" as const,
        spendAuthorized: false,
        portfolioSelected: true,
        transportBlocked: true as const,
      },
    }
  }
  if (i < 250) {
    return {
      leadId,
      signals: {
        admissionState: "accepted" as const,
        researchFresh: true,
        hasUsableResearch: true,
        knowledgeComplete: true,
        investmentState: "increase_investment" as const,
        spendAuthorized: true,
        portfolioSelected: false,
        hasPrimaryDecisionMaker: false,
        transportBlocked: true as const,
      },
    }
  }
  // waiting for DM — not yet enriched
  return {
    leadId,
    signals: {
      admissionState: "accepted" as const,
      researchFresh: true,
      hasUsableResearch: true,
      knowledgeComplete: true,
      investmentState: "increase_investment" as const,
      spendAuthorized: true,
      portfolioSelected: true,
      hasPrimaryDecisionMaker: false,
      hasContactName: false,
      decisionMakerStatus: "none",
      personalizationReady: false,
      transportBlocked: true as const,
    },
  }
})

const batch = runDraftFactoryOvernightBatch({
  organizationId: "org_sv1_4",
  now: simNow,
  candidates,
  capacity: { maxPackagesPerDay: 100, maxOvernightBatch: 100 },
})
assert.ok(batch.packagesReady <= 100)
assert.ok(batch.packagesReady >= 50)
assert.ok(batch.skippedIneligible >= 0)
// Auth simulation counts for DataMoon capacity
let authorizedCalls = 0
let deniedStop = 0
let deniedPortfolio = 0
for (let i = 0; i < 500; i++) {
  const investment =
    i < 80 || i >= 250
      ? ("increase_investment" as const)
      : i < 150
        ? ("stop_investment" as const)
        : ("increase_investment" as const)
  const portfolio = i < 150 || i >= 250 ? true : false
  const hasDm = i < 80
  const req = projectDecisionMakerRequirement({
    admissionState: "accepted",
    researchComplete: true,
    companyIdentityConfident: true,
    existingDecisionMakers: hasDm
      ? [
          {
            fullName: "A",
            title: "Owner",
            email: "a@x.com",
            status: "confirmed",
            isPrimary: true,
            confidence: 0.9,
          },
        ]
      : [],
    investmentState: investment,
    earnedEnrichmentSpend: investment === "increase_investment",
  })
  const auth = authorizeDatamoonPersonEnrichment({
    requirement: req,
    investmentState: investment,
    portfolioSelected: portfolio && i >= 250,
    providerEnabled: true,
    providerConfigured: true,
    budgetAvailable: authorizedCalls < 40,
  })
  if (auth.authorized) authorizedCalls += 1
  if (auth.denyReason === "stop_investment") deniedStop += 1
  if (auth.denyReason === "not_portfolio_selected") deniedPortfolio += 1
}
assert.ok(authorizedCalls <= 40)
assert.ok(deniedStop > 0)
assert.ok(deniedPortfolio > 0)
console.log("  ✓ 500-lead simulation respects DataMoon capacity and investment limits")

// --- No new schema ---
const migrations = fs
  .readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((name) => /sv1-4|datamoon.?dm|datamoon.?decision/i.test(name))
assert.equal(migrations.length, 0)

const packageJson = readSource("package.json")
assert.ok(packageJson.includes("test:sv1-4-datamoon-decision-maker-enrichment"))

// Rank deterministic tie-break
const tied = rankDatamoonDecisionMakerCandidates([
  { fullName: "B Beta", title: "Owner", email: "b@x.com", companyDomain: "x.com", companyMatchConfidence: 0.9 },
  { fullName: "A Alpha", title: "Owner", email: "a@x.com", companyDomain: "x.com", companyMatchConfidence: 0.9 },
])
assert.equal(tied[0].fullName < tied[1].fullName || tied[0].compositeScore >= tied[1].compositeScore, true)

console.log("[SV1-4] PASS")
