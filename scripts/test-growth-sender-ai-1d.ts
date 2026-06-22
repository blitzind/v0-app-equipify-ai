/**
 * GS-GROWTH-SENDER-AI-1D — Sender-aware AI generation certification.
 *
 * Run: pnpm test:growth-sender-ai-1d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthOutboundIdentityPromptBlock,
  buildGrowthOutboundIdentitySystemPromptAppendix,
  buildOutboundSenderPersonaInstructions,
  resolveOutboundSenderPersonaFromTitle,
} from "../lib/growth/signatures/outbound-sender-persona-instructions"
import { buildGrowthAiCopilotSystemPrompt } from "../lib/growth/ai-copilot-prompts"
import { buildOutreachRefinementSystemPrompt } from "../lib/growth/outreach/personalization/ai-refinement-prompts"
import {
  GROWTH_OUTBOUND_IDENTITY_AI_QA_MARKER,
  formatOutboundIdentityPreviewLabel,
} from "../lib/growth/signatures/outbound-identity-types"

const REQUIRED_FILES = [
  "lib/growth/signatures/outbound-identity-types.ts",
  "lib/growth/signatures/outbound-sender-persona-instructions.ts",
  "lib/growth/signatures/outbound-identity-context.ts",
  "components/growth/signatures/growth-outbound-sender-context-badge.tsx",
] as const

const WIRED_SURFACES = [
  "lib/growth/run-ai-copilot-generation.ts",
  "lib/growth/outreach/personalization/run-outreach-personalization.ts",
  "lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts",
  "lib/growth/sequence-enrollment/run-sequence-scheduler.ts",
  "lib/growth/sequences/execution/queue-sequence-step-transport-job.ts",
  "lib/growth/apollo/apollo-sequence-personalization-service.ts",
  "lib/growth/replies/reply-draft-repository.ts",
  "app/api/platform/growth/leads/[leadId]/copilot/generate/route.ts",
  "components/growth/growth-ai-copilot.tsx",
] as const

const REUSED = [
  "lib/growth/signatures/signature-resolver.ts",
  "lib/growth/signatures/sender-merge-fields.ts",
  "lib/growth/signatures/outbound-signature-runtime.ts",
  "lib/growth/sendr/growth-sendr-sequence-bridge-service.ts",
  "lib/growth/sequences/execution/sequence-send-builder.ts",
] as const

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

console.log(`\n=== GS-GROWTH-SENDER-AI-1D (${GROWTH_OUTBOUND_IDENTITY_AI_QA_MARKER}) ===\n`)

assert.equal(GROWTH_OUTBOUND_IDENTITY_AI_QA_MARKER, "growth-outbound-identity-ai-1d-v1")
console.log("  ✓ QA marker")

for (const file of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `Missing ${file}`)
}
console.log(`  ✓ ${REQUIRED_FILES.length} new identity modules`)

for (const file of REUSED) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `Missing reused ${file}`)
}
console.log(`  ✓ ${REUSED.length} reused infrastructure modules`)

for (const file of WIRED_SURFACES) {
  const source = readSource(file)
  assert.match(source, /resolveGrowthOutboundIdentityContext|outboundIdentity|senderAccountId|sequencePatternStepId/)
}
console.log(`  ✓ ${WIRED_SURFACES.length} generation surfaces wired`)

const founder = resolveOutboundSenderPersonaFromTitle("Founder")
const advisor = resolveOutboundSenderPersonaFromTitle("Solutions Advisor")
const csm = resolveOutboundSenderPersonaFromTitle("Customer Success Manager")
assert.equal(founder.key, "founder")
assert.equal(advisor.key, "solutions_advisor")
assert.equal(csm.key, "customer_success_manager")
console.log("  ✓ Persona resolution from sender titles")

const founderPrompt = buildGrowthOutboundIdentityPromptBlock({
  displayName: "Michael Short",
  title: "Founder",
  company: "Equipify.ai",
  personaInstructions: buildOutboundSenderPersonaInstructions(founder),
})
const advisorPrompt = buildGrowthOutboundIdentityPromptBlock({
  displayName: "Daniel Hall",
  title: "Solutions Advisor",
  company: "Equipify.ai",
  personaInstructions: buildOutboundSenderPersonaInstructions(advisor),
})
assert.match(founderPrompt, /Michael Short/)
assert.match(founderPrompt, /peer operator/i)
assert.match(advisorPrompt, /Daniel Hall/)
assert.match(advisorPrompt, /discovery-oriented/i)
assert.notEqual(founderPrompt, advisorPrompt)
console.log("  ✓ Distinct persona prompt blocks for Founder vs Solutions Advisor")

const copilotSystem = buildGrowthAiCopilotSystemPrompt("cold_email", "default", [], {
  senderAccountId: "s1",
  senderProfileId: "p1",
  displayName: "Daniel Hall",
  title: "Solutions Advisor",
  company: "Equipify.ai",
  website: "https://equipify.ai",
  email: "daniel@equipify.ai",
  personaKey: "solutions_advisor",
  personaInstructions: buildOutboundSenderPersonaInstructions(advisor),
})
assert.match(copilotSystem, /Daniel Hall/)
assert.match(copilotSystem, /Do not include a signature block/)
console.log("  ✓ Copilot system prompt includes sender identity")

const refinementSystem = buildOutreachRefinementSystemPrompt(120, {
  senderAccountId: "s1",
  senderProfileId: "p1",
  displayName: "Michael Short",
  title: "Founder",
  company: "Equipify.ai",
  website: "https://equipify.ai",
  email: "mike@equipify.ai",
  personaKey: "founder",
  personaInstructions: buildOutboundSenderPersonaInstructions(founder),
})
assert.match(refinementSystem, /Michael Short/)
console.log("  ✓ Personalization refinement system prompt includes sender identity")

assert.equal(
  formatOutboundIdentityPreviewLabel({ displayName: "Michael Short", title: "Founder" }),
  "As: Michael Short — Founder",
)
assert.equal(
  formatOutboundIdentityPreviewLabel({ displayName: "Daniel Hall", title: "Solutions Advisor" }),
  "As: Daniel Hall — Solutions Advisor",
)
console.log("  ✓ Preview label formatting")

const runtime = readSource("lib/growth/signatures/outbound-signature-runtime.ts")
assert.match(runtime, /prepareOutboundEmailContent/)
assert.match(readSource("lib/growth/run-ai-copilot-generation.ts"), /prepareGrowthAiCopilotOutboundEmailContent/)
console.log("  ✓ Signature injection runtime unchanged (send-time append)")

const appendix = buildGrowthOutboundIdentitySystemPromptAppendix(null)
assert.equal(appendix, "")
console.log("  ✓ Graceful degradation when identity missing")

console.log("\nGS-GROWTH-SENDER-AI-1D certification passed.\n")
