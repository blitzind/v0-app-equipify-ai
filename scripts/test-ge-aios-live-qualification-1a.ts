/**
 * GE-AIOS-LIVE-QUALIFICATION-1A — Unit tests for qualification unblock diagnosis.
 */
import assert from "node:assert/strict"
import {
  GROWTH_AIOS_LIVE_QUALIFICATION_1A_QA_MARKER,
  CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR,
} from "../lib/growth/training/live-qualification-production-unblock-1a"
import { evaluateQualificationPilotAutonomyPolicyGate } from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { buildGrowthAiOsAutonomyPolicyReadModel } from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"

console.log(`[${GROWTH_AIOS_LIVE_QUALIFICATION_1A_QA_MARKER}] Live qualification unblock tests`)

const orgId = "00757488-1026-44a5-aac4-269533ac21be"
const baseSettings = buildDefaultGrowthAutonomySettings(orgId)
const kill = {
  autonomyEnabled: true,
  autonomyOutboundEnabled: false,
  autonomyGenerationEnabled: true,
  autonomyObjectiveModeEnabled: true,
}

const manualPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  settings: { ...baseSettings, killSwitches: kill },
  runtimeEnabled: true,
  runtimePilotEnabled: true,
})
const manualGate = evaluateQualificationPilotAutonomyPolicyGate({ policy: manualPolicy })
assert.equal(manualPolicy.qualificationAutonomyEnabled, false)
assert.equal(manualGate.policyKey, "qualification_autonomy_disabled")
console.log("  ✓ manual mode + enrichment off blocks qualification")

const objectivePolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  settings: {
    ...baseSettings,
    masterMode: "objective",
    capabilityToggles: { ...baseSettings.capabilityToggles, enrichment: true },
    killSwitches: kill,
  },
  runtimeEnabled: true,
  runtimePilotEnabled: true,
})
const objectiveGate = evaluateQualificationPilotAutonomyPolicyGate({ policy: objectivePolicy })
assert.equal(objectivePolicy.qualificationAutonomyEnabled, true)
assert.equal(objectiveGate.allowed, true)
console.log("  ✓ objective mode + enrichment enables qualification gate")

assert.equal(CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR, "CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR")
console.log("\nAll live qualification unblock tests passed.")
