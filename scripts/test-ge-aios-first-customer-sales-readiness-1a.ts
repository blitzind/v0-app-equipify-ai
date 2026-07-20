/**
 * GE-AIOS-FIRST-CUSTOMER-SALES-READINESS-1A — Milestone certification.
 * Run: pnpm test:ge-aios-first-customer-sales-readiness-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AIOS_FIRST_CUSTOMER_SALES_READINESS_1A_QA_MARKER } from "../lib/growth/training/canonical-seller-knowledge-audit-1a"
import { GROWTH_AIOS_CANONICAL_SELLER_KNOWLEDGE_1A_QA_MARKER } from "../lib/growth/business-profile/canonical-seller-knowledge-types"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { SUPPORTED_SERVICE_VERTICALS_REGISTRY } from "../lib/growth/business-profile/supported-service-verticals"
import {
  onboardCanonicalSellerKnowledge,
  isCanonicalSellerKnowledgeEnriched,
} from "../lib/growth/training/canonical-seller-knowledge-onboarding-1a"
import { auditSellerKnowledgeCompleteness } from "../lib/growth/training/canonical-seller-knowledge-audit-1a"
import { certifySellerReadiness } from "../lib/growth/training/canonical-seller-knowledge-readiness-1a"
import { runSalesSimulation } from "../lib/growth/training/canonical-seller-knowledge-sales-simulation-1a"
import {
  buildEquipifyOnboardingSources,
  FUTURE_CUSTOMER_VERTICAL_SMOKE_TESTS,
  resolveCanonicalSellerKnowledgeSeedForOrganization,
} from "../lib/growth/training/equipify-canonical-seller-knowledge-seed-1a"
import { enrichBusinessProfileWithEquipifyMasterKnowledge } from "../lib/growth/business-profile/equipify-master-knowledge-merge"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_FIRST_CUSTOMER_SALES_READINESS_1A_QA_MARKER}] First Customer Sales Readiness certification\n`)

// Phase 1 — Knowledge architecture exists and is org-agnostic
const typesSource = readSource("lib/growth/business-profile/canonical-seller-knowledge-types.ts")
assert.match(typesSource, /CanonicalSellerKnowledge/)
assert.match(typesSource, /salesPhilosophyPrinciples/)
assert.doesNotMatch(typesSource, /Equipify/)
console.log("  ✓ Phase 2 — generic canonical seller knowledge model")

const onboardingSource = readSource("lib/growth/training/canonical-seller-knowledge-onboarding-1a.ts")
assert.match(onboardingSource, /without overwriting operator edits/)
assert.match(onboardingSource, /contentFingerprint/)
assert.match(onboardingSource, /isRuntimeSourceOfTruth: false/)
console.log("  ✓ Phase 3 — idempotent onboarding with provenance")

const readinessSource = readSource("lib/growth/training/canonical-seller-knowledge-readiness-1a.ts")
assert.match(readinessSource, /supervisedSellingAllowed/)
assert.match(readinessSource, /critical/)
console.log("  ✓ Phase 4 — seller readiness certification")

const simulationSource = readSource("lib/growth/training/canonical-seller-knowledge-sales-simulation-1a.ts")
assert.match(simulationSource, /outboundEnabled: false/)
assert.match(simulationSource, /SIMULATION ONLY/)
console.log("  ✓ Phase 5 — sales simulation (no sends)")

// Business Profile remains SoT — no duplicate stores
const sellerTruthSource = readSource("lib/growth/aios/growth/growth-outreach-seller-truth.ts")
assert.match(sellerTruthSource, /Approved Business Profile/)
assert.doesNotMatch(sellerTruthSource, /getEquipifyMasterContext/)
console.log("  ✓ Business Profile remains single source of truth")

// Equipify is first populated org, not hardcoded pipeline
const seedSource = readSource("lib/growth/training/equipify-canonical-seller-knowledge-seed-1a.ts")
assert.match(seedSource, /resolveCanonicalSellerKnowledgeSeedForOrganization/)
assert.match(onboardingSource, /organizationId/)
console.log("  ✓ Phase 7 — onboarding pipeline is organization-agnostic")

const equipifyProfileBase = buildLive1bEquipifyCompanyProfileContent()
const equipifyOnboarded = onboardCanonicalSellerKnowledge({
  organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  profile: equipifyProfileBase,
  sources: buildEquipifyOnboardingSources(),
  ingestedAt: "2026-07-16T12:00:00.000Z",
}).profile
assert.ok(isCanonicalSellerKnowledgeEnriched(equipifyOnboarded))

const audit = auditSellerKnowledgeCompleteness({
  organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  profile: equipifyOnboarded,
})
assert.ok(audit.presentCount >= 15, `Expected substantial knowledge coverage, got ${audit.presentCount} present`)
console.log(
  `  ✓ Phase 1 audit — ${audit.presentCount} present, ${audit.partialCount} partial, ${audit.missingCount} missing`,
)

const certification = certifySellerReadiness({
  organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  profile: equipifyOnboarded,
})
assert.ok(certification.readinessScore >= 0.75, `Readiness score ${certification.readinessScore}`)
assert.equal(certification.checks.filter((row) => !row.passed).length, 0, certification.deficiencies.join("; "))
console.log(`  ✓ Seller readiness score: ${(certification.readinessScore * 100).toFixed(0)}%`)
console.log(`  ✓ Supervised selling allowed: ${certification.supervisedSellingAllowed}`)

const simulation = runSalesSimulation({
  organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  profile: equipifyOnboarded,
})
assert.equal(simulation.results.length, 5)
assert.ok(simulation.results.every((row) => row.personalizedOutreach.length > 20))
assert.ok(simulation.results.every((row) => row.approvalPackageSummary.includes("SIMULATION ONLY")))
const qualified = simulation.results.filter((row) => row.scenario.expectedQualification === "qualified")
const disqualified = simulation.results.filter((row) => row.scenario.expectedQualification === "disqualified")
assert.ok(qualified.every((row) => row.admissionState !== "invalid"))
assert.ok(disqualified.some((row) => row.admissionState === "rejected" || row.disqualificationExplanation.length > 0))
console.log(`  ✓ Sales simulation — ${simulation.results.length} prospects (3 qualified, 2 disqualified)`)

// Onboarding idempotency
const baseProfile = buildLive1bEquipifyCompanyProfileContent()
const sources = buildEquipifyOnboardingSources()
const onboarded = onboardCanonicalSellerKnowledge({
  organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  profile: { ...baseProfile, canonicalSellerKnowledge: undefined, masterKnowledgeIngestion: undefined },
  sources,
  ingestedAt: "2026-07-16T12:00:00.000Z",
})
assert.ok(onboarded.profile.canonicalSellerKnowledge)
assert.equal(onboarded.profile.masterKnowledgeIngestion?.isRuntimeSourceOfTruth, false)
assert.equal(onboarded.profile.masterKnowledgeIngestion?.ingestionVersion, GROWTH_AIOS_CANONICAL_SELLER_KNOWLEDGE_1A_QA_MARKER)

const idempotent = onboardCanonicalSellerKnowledge({
  organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  profile: onboarded.profile,
  sources,
  ingestedAt: "2026-07-16T12:00:00.000Z",
})
assert.equal(idempotent.idempotent, true)
console.log("  ✓ Onboarding idempotency verified")

// Operator edits preserved
const operatorProfile = enrichBusinessProfileWithEquipifyMasterKnowledge(baseProfile)
operatorProfile.company.shortDescription = "Operator-authored description must survive onboarding."
const preserved = onboardCanonicalSellerKnowledge({
  organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  profile: operatorProfile,
  sources,
})
assert.equal(preserved.profile.company.shortDescription, "Operator-authored description must survive onboarding.")
assert.ok(preserved.operatorPreserved.includes("company.shortDescription"))
console.log("  ✓ Operator edits preserved during onboarding")

// Future customer vertical smoke tests
for (const verticalId of FUTURE_CUSTOMER_VERTICAL_SMOKE_TESTS) {
  assert.ok(
    SUPPORTED_SERVICE_VERTICALS_REGISTRY.some((row) => row.id === verticalId),
    `Missing vertical registry entry: ${verticalId}`,
  )
}
assert.equal(resolveCanonicalSellerKnowledgeSeedForOrganization("other-org-id"), null)
assert.ok(resolveCanonicalSellerKnowledgeSeedForOrganization(EQUIPIFY_PRODUCTION_ORG_ID))
console.log(`  ✓ Future customer verticals — ${FUTURE_CUSTOMER_VERTICAL_SMOKE_TESTS.length} validated in registry`)

// Critical blockers gate supervised selling
const emptyCert = certifySellerReadiness({
  organizationId: "00000000-0000-0000-0000-000000000000",
  profile: null,
})
assert.equal(emptyCert.supervisedSellingAllowed, false)
assert.ok(emptyCert.blockers.some((row) => row.severity === "critical"))
console.log("  ✓ Critical blockers prevent unsupervised selling")

console.log(`\nPASS ${GROWTH_AIOS_FIRST_CUSTOMER_SALES_READINESS_1A_QA_MARKER}`)
console.log(`Readiness: ${(certification.readinessScore * 100).toFixed(0)}% | Supervised selling: ${certification.supervisedSellingAllowed}`)
console.log(`Remaining deficiencies: ${certification.deficiencies.length === 0 ? "none" : certification.deficiencies.join("; ")}`)
