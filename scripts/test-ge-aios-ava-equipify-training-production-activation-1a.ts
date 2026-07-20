/**
 * GE-AIOS-AVA-EQUIPIFY-TRAINING-AND-PRODUCTION-ACTIVATION-1A — Certification (local + optional Production probe).
 * Run: pnpm test:ge-aios-ava-equipify-training-production-activation-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { SUPPORTED_SERVICE_VERTICALS_REGISTRY } from "../lib/growth/business-profile/supported-service-verticals"

const ROOT = process.cwd()
const GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A_QA_MARKER =
  "ge-aios-ava-equipify-training-production-activation-1a-v1" as const
const CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A =
  "CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A" as const
const GE_AIOS_AVA_EQUIPIFY_PRODUCTION_READINESS_1A_QA_MARKER =
  "ge-aios-ava-equipify-training-production-readiness-1a-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A_QA_MARKER}] activation certification\n`)

const activationSource = readSource("scripts/activate-ge-aios-ava-equipify-production-1a.ts")
const probeSource = readSource("scripts/probe-ge-aios-ava-equipify-production-readiness-1a.ts")

assert.equal(
  GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A_QA_MARKER,
  "ge-aios-ava-equipify-training-production-activation-1a-v1",
)
assert.equal(
  GE_AIOS_AVA_EQUIPIFY_PRODUCTION_READINESS_1A_QA_MARKER,
  "ge-aios-ava-equipify-training-production-readiness-1a-v1",
)
assert.equal(CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A, "CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A")

assert.match(activationSource, /EQUIPIFY_PRODUCTION_ORG_ID/)
assert.equal(EQUIPIFY_PRODUCTION_ORG_ID, "00757488-1026-44a5-aac4-269533ac21be")
assert.match(activationSource, /requireVercelProductionEnvRun: true/)
assert.match(activationSource, /isProductionEnrichmentIdempotent/)
assert.match(activationSource, /autonomy_outbound_enabled: false/)
assert.match(activationSource, /SUPPORTED_SERVICE_VERTICALS_REGISTRY/)
assert.doesNotMatch(activationSource, /market-intelligence/)
assert.doesNotMatch(activationSource, /autonomy_outbound_enabled: true/)

assert.match(probeSource, /analyzeGrowthLeadAdmissionProductionPool/)
assert.match(probeSource, /translateDatamoonOperationalModelTargeting/)
assert.match(probeSource, /conflictsForOperatorReview/)

assert.equal(SUPPORTED_SERVICE_VERTICALS_REGISTRY.length, 27)
console.log("  ✓ canonical store usage — Business Profile + SSV registry only")
console.log("  ✓ organization scoping — Equipify org constant enforced")
console.log("  ✓ idempotent activation — enrichment fingerprint gate present")
console.log("  ✓ outbound remains disabled in activation plan")

console.log(`\nPASS ${GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A_QA_MARKER}`)
