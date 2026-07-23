/**
 * FUZOR-ADOPTION-1G — Runtime profile & enablement delegation parity.
 * Run: pnpm test:fuzor-adoption-1g-runtime-profile-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  PLATFORM_RUNTIME_PROFILE_IDS,
  PLATFORM_RUNTIME_PROFILE_VERSION,
  PLATFORM_RUNTIME_PROFILES,
  getPlatformRuntimeProfile,
  isPlatformGrowthEngineEnabledEnv,
  listPlatformRuntimeProfileIds,
  readPlatformGrowthEngineAiOrgIdFromEnv,
  resolvePlatformRuntimeProfileId,
  setPlatformConfigurationEnvReaderForTests,
  setPlatformRuntimeProfileEnvReaderForTests,
} from "@fuzor/configuration"

import {
  GROWTH_RUNTIME_PROFILE_IDS,
  GROWTH_RUNTIME_PROFILE_VERSION,
  GROWTH_RUNTIME_PROFILES,
  getGrowthRuntimeProfile,
  listGrowthRuntimeProfileIds,
  resolveGrowthRuntimeProfileId,
} from "../lib/growth/runtime/growth-runtime-profile"

import {
  isGrowthEngineEnabledEnv,
  getGrowthEngineAiOrgId,
} from "../lib/growth/growth-engine-session"

import {
  getRuntimeKillSwitchStates,
  isRuntimeKillSwitchEnabled,
  isWakeExecutionEnabled,
  setRuntimeKillSwitch,
} from "../lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[FUZOR-ADOPTION-1G] Runtime profile & enablement delegation parity")

assert.strictEqual(GROWTH_RUNTIME_PROFILE_VERSION, PLATFORM_RUNTIME_PROFILE_VERSION)
assert.strictEqual(GROWTH_RUNTIME_PROFILES, PLATFORM_RUNTIME_PROFILES)
assert.deepEqual([...GROWTH_RUNTIME_PROFILE_IDS], [...PLATFORM_RUNTIME_PROFILE_IDS])
assert.deepEqual(listGrowthRuntimeProfileIds(), listPlatformRuntimeProfileIds())

for (const profileId of PLATFORM_RUNTIME_PROFILE_IDS) {
  assert.deepEqual(getGrowthRuntimeProfile(profileId), getPlatformRuntimeProfile(profileId))
}

setPlatformRuntimeProfileEnvReaderForTests((name) => {
  if (name === "GROWTH_RUNTIME_PROFILE") return "full_admin"
  return undefined
})
assert.strictEqual(resolveGrowthRuntimeProfileId(), "full_admin")
assert.strictEqual(resolvePlatformRuntimeProfileId(), "full_admin")
setPlatformRuntimeProfileEnvReaderForTests(null)

setPlatformConfigurationEnvReaderForTests((name) => {
  if (name === "GROWTH_ENGINE_ENABLED") return "true"
  if (name === "GROWTH_ENGINE_AI_ORG_ID") return "00000000-0000-4000-8000-000000000001"
  return undefined
})
assert.strictEqual(isGrowthEngineEnabledEnv(), isPlatformGrowthEngineEnabledEnv())
assert.strictEqual(getGrowthEngineAiOrgId(), readPlatformGrowthEngineAiOrgIdFromEnv())
setPlatformConfigurationEnvReaderForTests(null)

const runtimeProfile = readSource("lib/growth/runtime/growth-runtime-profile.ts")
assert.ok(runtimeProfile.includes("@fuzor/configuration"))
assert.ok(!runtimeProfile.includes("GROWTH_FEATURE_REGISTRY"))

const killSwitch = readSource("lib/growth/runtime-guardrails/growth-runtime-kill-switch-service.ts")
assert.ok(killSwitch.includes("@fuzor/configuration"))
assert.ok(!killSwitch.includes("probeRuntimeTable"))

const session = readSource("lib/growth/growth-engine-session.ts")
assert.ok(session.includes("isPlatformGrowthEngineEnabledEnv"))
assert.ok(session.includes("readPlatformGrowthEngineAiOrgIdFromEnv"))

assert.strictEqual(typeof isRuntimeKillSwitchEnabled, "function")
assert.strictEqual(typeof getRuntimeKillSwitchStates, "function")
assert.strictEqual(typeof setRuntimeKillSwitch, "function")
assert.strictEqual(typeof isWakeExecutionEnabled, "function")

console.log("[FUZOR-ADOPTION-1G] wrapper delegation verified")

// Phase 7 — future multi-product runtime simulation (architecture proof)
const avaProfile = getPlatformRuntimeProfile("operator_minimal")
const ivyProfile = getPlatformRuntimeProfile("full_admin")

assert.strictEqual(avaProfile.id, "operator_minimal")
assert.strictEqual(ivyProfile.id, "full_admin")
assert.notStrictEqual(avaProfile.tierPolicy[2].visible, ivyProfile.tierPolicy[2].visible)

assert.equal(runtimeProfile.includes("workflow"), false)
assert.equal(runtimeProfile.includes("DataMoon"), false)
assert.equal(killSwitch.includes("autonomous"), false)

console.log("[FUZOR-ADOPTION-1G] multi-product runtime architecture proof")

console.log("[FUZOR-ADOPTION-1G] PASS")
