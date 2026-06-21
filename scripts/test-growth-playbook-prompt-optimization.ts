/**
 * GS-AI-PLAYBOOK-2D certification — channel-specific prompt optimization.
 */

import assert from "node:assert/strict"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import { buildGrowthPlaybookOrchestratedPrompt } from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import {
  GROWTH_PLAYBOOK_CHANNEL_BUDGET_TIER,
  GROWTH_PLAYBOOK_PROMPT_BUDGET_CHAR_LIMITS,
} from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-budget-service"
import {
  GROWTH_PLAYBOOK_PROMPT_NEVER_TRIM,
  GROWTH_PLAYBOOK_PROMPT_TRIM_ORDER,
} from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-channel-rules"
import {
  GROWTH_PLAYBOOK_PROMPT_OPTIMIZATION_QA_MARKER,
  optimizeGrowthPlaybookPrompt,
} from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimizer"

function buildSterlingContext() {
  return buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    naics: ["621999"],
    verifiedFacts: ["provides field service and biomedical support for medical equipment organizations"],
    researchSignals: ["PM compliance tracking for patient-connected devices"],
    decisionMakerTitle: "Compliance Manager",
  })
}

function runOptimizationCert(): void {
  assert.equal(GROWTH_PLAYBOOK_PROMPT_OPTIMIZATION_QA_MARKER, "growth-playbook-prompt-optimization-gs-ai-playbook-2d-v1")
  assert.equal(GROWTH_PLAYBOOK_CHANNEL_BUDGET_TIER.SMS, "VERY_SMALL")
  assert.equal(GROWTH_PLAYBOOK_PROMPT_BUDGET_CHAR_LIMITS.VERY_SMALL, 1_200)
  assert.deepEqual(GROWTH_PLAYBOOK_PROMPT_TRIM_ORDER[0], "avoid")
  assert.ok(GROWTH_PLAYBOOK_PROMPT_NEVER_TRIM.includes("narrative_direction"))
  console.log("✓ optimization constants — budgets, trim order, never-trim sections")
}

function runSmsChannelCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "sms",
    optimizationChannel: "SMS",
  })!
  const diagnostics = orchestrated.promptOptimization!
  assert.equal(diagnostics.channel, "SMS")
  assert.ok(diagnostics.estimatedPromptSize <= diagnostics.budgetLimit)
  assert.ok(diagnostics.weightingPreserved)
  assert.ok(!orchestrated.formattedBlock.includes("=== Industry Intelligence"))
  assert.ok(orchestrated.formattedBlock.includes("=== Narrative Direction ==="))
  assert.ok(orchestrated.formattedBlock.includes("=== Recommended Language ==="))
  assert.ok(orchestrated.formattedBlock.includes("=== Preferred CTA ==="))
  console.log("✓ SMS channel — compact prompt, critical sections only")
}

function runVoiceChannelCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "voice",
    optimizationChannel: "VOICE",
  })!
  const diagnostics = orchestrated.promptOptimization!
  assert.equal(diagnostics.channel, "VOICE")
  assert.ok(orchestrated.formattedBlock.includes("=== Buyer Persona Framework ==="))
  assert.ok(orchestrated.formattedBlock.includes("=== Preferred Proof ==="))
  assert.ok(orchestrated.formattedBlock.includes("=== Preferred CTA ==="))
  console.log("✓ VOICE channel — conversational sections prioritized")
}

function runEmailChannelCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "email",
    optimizationChannel: "EMAIL",
  })!
  assert.ok(orchestrated.formattedBlock.includes("=== Buyer Persona Framework ==="))
  assert.ok(orchestrated.formattedBlock.includes("=== Preferred Proof ==="))
  assert.ok(orchestrated.promptOptimization!.weightingPreserved)
  console.log("✓ EMAIL channel — persona framework + proof retained")
}

function runCopilotChannelCert(): void {
  const context = buildSterlingContext()
  const full = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "copilot",
    optimizationChannel: "COPILOT",
  })!
  assert.ok(full.formattedBlock.includes("=== Industry Intelligence"))
  assert.ok(full.formattedBlock.includes("=== Emphasize ==="))
  assert.ok(full.formattedBlock.includes("=== Avoid ==="))
  console.log("✓ COPILOT channel — full context preserved")
}

function runWeightingPreservationCert(): void {
  const sparse = buildSterlingContext()
  sparse.verifiedFacts = []
  const rebuilt = buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    naics: ["621999"],
    verifiedFacts: [],
    researchSignals: ["PM compliance"],
  })
  const optimized = optimizeGrowthPlaybookPrompt({
    channel: "SMS",
    orchestrated: buildGrowthPlaybookOrchestratedPrompt({
      industryContext: rebuilt,
      narrativeContext: rebuilt.narrativeContext,
      skipOptimization: true,
    })!,
    header: "Industry playbook: Sterling",
  })
  assert.match(optimized.optimizedPrompt, /~20%/i)
  assert.match(optimized.optimizedPrompt, /~80%/i)
  assert.equal(optimized.diagnostics.weightingPreserved, true)
  console.log("✓ weighting preservation — 20/80 retained under optimization")
}

function runDiagnosticsCert(): void {
  const context = buildSterlingContext()
  const orchestrated = buildGrowthPlaybookOrchestratedPrompt({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "page",
    optimizationChannel: "SHARE_PAGE",
  })!
  const diagnostics = orchestrated.promptOptimization!
  assert.ok(diagnostics.sectionsIncluded.length > 0)
  assert.ok(typeof diagnostics.budgetUtilization === "number")
  assert.ok(["channel_defaults", "budget_trim", "full_context"].includes(diagnostics.optimizationStrategy))
  console.log("✓ diagnostics — channel, size, sections, utilization, strategy")
}

function main(): void {
  runOptimizationCert()
  runSmsChannelCert()
  runVoiceChannelCert()
  runEmailChannelCert()
  runCopilotChannelCert()
  runWeightingPreservationCert()
  runDiagnosticsCert()
  console.log("\nGS-AI-PLAYBOOK-2D certification passed")
}

main()
