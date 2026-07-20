/**
 * GE-AIOS-OPERATOR-PACKAGE-1A — Unit tests for outreach preparation autonomy gate diagnosis.
 */
import assert from "node:assert/strict"
import {
  GROWTH_AIOS_OPERATOR_PACKAGE_1A_QA_MARKER,
  CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR,
} from "../lib/growth/training/operator-package-production-validation-1a"
import {
  buildGrowthAiOsAutonomyPolicyReadModel,
  evaluateOutreachPreparationPilotAutonomyPolicyGate,
} from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"

console.log(`[${GROWTH_AIOS_OPERATOR_PACKAGE_1A_QA_MARKER}] Operator package unblock tests`)

const orgId = "00757488-1026-44a5-aac4-269533ac21be"
const baseSettings = buildDefaultGrowthAutonomySettings(orgId)
const kill = {
  autonomyEnabled: true,
  autonomyOutboundEnabled: false,
  autonomyGenerationEnabled: true,
  autonomyObjectiveModeEnabled: true,
}

const blockedPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  settings: {
    ...baseSettings,
    masterMode: "manual",
    capabilityToggles: {
      ...baseSettings.capabilityToggles,
      page_generation: false,
      recommendations: false,
      email_execution: false,
    },
    killSwitches: kill,
  },
  runtimeEnabled: true,
  runtimePilotEnabled: true,
})
const blockedGate = evaluateOutreachPreparationPilotAutonomyPolicyGate({ policy: blockedPolicy })
assert.equal(blockedPolicy.outreachAutonomyEnabled, false)
assert.equal(blockedGate.policyKey, "outreach_autonomy_disabled")
console.log("  ✓ manual mode + prep capabilities off blocks outreach preparation")

const enabledPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  settings: {
    ...baseSettings,
    masterMode: "objective",
    capabilityToggles: {
      ...baseSettings.capabilityToggles,
      page_generation: true,
      recommendations: true,
      email_execution: true,
    },
    killSwitches: kill,
  },
  runtimeEnabled: true,
  runtimePilotEnabled: true,
})
const enabledGate = evaluateOutreachPreparationPilotAutonomyPolicyGate({ policy: enabledPolicy })
assert.equal(enabledPolicy.outreachAutonomyEnabled, true)
assert.equal(enabledGate.allowed, true)
assert.equal(kill.autonomyOutboundEnabled, false)
console.log("  ✓ objective prep capabilities enable package gate while outbound stays off")

assert.equal(CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR, "CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR")
console.log("\nAll operator package unblock tests passed.")
