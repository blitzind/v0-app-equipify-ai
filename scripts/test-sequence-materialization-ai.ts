/**
 * Sequence-Materialization-1 — AI draft generation certification structure.
 * Run: pnpm test:sequence-materialization-ai
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CERT_DEFAULT_AI_ORG_ID,
} from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const ORCHESTRATOR = "lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts"
const AI_GENERATION = "lib/growth/run-ai-copilot-generation.ts"
const AI_PROVIDER = "lib/growth/ai-copilot-provider.ts"
const ACCESS = "lib/growth/access.ts"
const DIAGNOSE = "scripts/diagnose-sequence-materialization-ai.ts"
const CERT_BOOTSTRAP = "lib/growth/qa/verified-channels-cert-env-bootstrap.ts"

for (const relativePath of [ORCHESTRATOR, AI_GENERATION, AI_PROVIDER, ACCESS, DIAGNOSE, CERT_BOOTSTRAP]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const orchestrator = fs.readFileSync(path.join(process.cwd(), ORCHESTRATOR), "utf8")
const aiGeneration = fs.readFileSync(path.join(process.cwd(), AI_GENERATION), "utf8")
const aiProvider = fs.readFileSync(path.join(process.cwd(), AI_PROVIDER), "utf8")
const access = fs.readFileSync(path.join(process.cwd(), ACCESS), "utf8")
const certBootstrap = fs.readFileSync(path.join(process.cwd(), CERT_BOOTSTRAP), "utf8")

assert.match(orchestrator, /confirmGrowthSequenceEnrollment/)
assert.match(orchestrator, /materializeGrowthSequenceEnrollmentStep/)
assert.match(orchestrator, /runGrowthAiCopilotGeneration/)
console.log("  ✓ materialization path — confirm → materialize → runGrowthAiCopilotGeneration")

assert.match(aiGeneration, /fetchGrowthCopilotSettings/)
assert.match(aiGeneration, /getGrowthAiProvider/)
assert.match(aiGeneration, /provider\.health\(\)/)
assert.match(aiGeneration, /ai_not_configured/)
console.log("  ✓ AI generation — copilot settings + provider health gate")

assert.match(aiProvider, /GrowthEngineAiProvider/)
assert.match(aiProvider, /getGrowthEngineAiOrgId/)
assert.match(aiProvider, /runAiTask/)
console.log("  ✓ provider — GrowthEngineAiProvider scopes runAiTask via GROWTH_ENGINE_AI_ORG_ID")

assert.match(access, /GROWTH_ENGINE_AI_ORG_ID/)
assert.match(certBootstrap, /GROWTH_CERT_DEFAULT_AI_ORG_ID/)
assert.match(certBootstrap, new RegExp(GROWTH_CERT_DEFAULT_AI_ORG_ID))
console.log("  ✓ cert bootstrap — GROWTH_ENGINE_AI_ORG_ID fallback for CLI diagnostics")

assert.equal(GROWTH_CERT_DEFAULT_AI_ORG_ID, "00757488-1026-44a5-aac4-269533ac21be")
console.log("  ✓ default org — Blitz internal org UUID")

console.log("\nSequence-Materialization-1 structure certification passed.")
