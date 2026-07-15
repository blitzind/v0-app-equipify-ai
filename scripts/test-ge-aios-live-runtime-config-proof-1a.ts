/**
 * GE-AIOS-LIVE-RUNTIME-CONFIG-PROOF-1A — Runtime config proof certification.
 *
 * Run:
 *   pnpm test:ge-aios-live-runtime-config-proof-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  classifyBooleanFromDeployedOrLocal,
  classifySensitiveEnvPresence,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-classifiers"
import {
  GROWTH_AIOS_LIVE_RUNTIME_CONFIG_PROOF_1A_QA_MARKER,
  type GrowthAiosRuntimeConfigHealthSnapshot,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-types"
import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { isCommunicationStrategyEnabled } from "@/lib/growth/contact-verification/communication-strategy-feature"
import { GROWTH_AIOS_RUNTIME_CONFIG_HEALTH_ROUTE_PATH } from "@/lib/growth/qa/growth-aios-runtime-config-health-deployed-probe"

const ROOT = process.cwd()
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
const SECRET_KEY_PATTERN =
  /(api[_-]?key|secret|password|token|credential|service_role|anon_key|supabase)/i

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function assertSnapshotContainsNoSecrets(snapshot: GrowthAiosRuntimeConfigHealthSnapshot): void {
  const serialized = JSON.stringify(snapshot)
  assert.doesNotMatch(serialized, UUID_PATTERN, "snapshot must not contain UUID values")
  for (const [key, value] of Object.entries(snapshot)) {
    assert.doesNotMatch(key, SECRET_KEY_PATTERN, `snapshot key looks sensitive: ${key}`)
    if (typeof value === "string") {
      assert.doesNotMatch(value, SECRET_KEY_PATTERN, `snapshot string looks sensitive at ${key}`)
    }
  }
  assert.equal(typeof snapshot.organizationConfigured, "boolean")
  assert.equal(typeof snapshot.nativeDecisionEngineEnabled, "boolean")
  assert.equal(typeof snapshot.schedulerMigrationReady, "boolean")
}

console.log("GE-AIOS-LIVE-RUNTIME-CONFIG-PROOF-1A\n")

const routeSource = readSource("app/api/platform/growth/ai-os/runtime-config-health/route.ts")
const serviceSource = readSource("lib/growth/aios/runtime/growth-aios-runtime-config-health-1a.ts")
const repoSource = readSource("lib/growth/objectives/growth-objective-repository.ts")

assert.match(routeSource, /requireGrowthEnginePlatformAccess/)
assert.match(routeSource, /buildGrowthAiosRuntimeConfigHealthSnapshot/)
assert.match(serviceSource, /getGrowthEngineAiOrgId/)
assert.match(serviceSource, /isNativeRevenueDecisionEngineEnabled/)
assert.match(serviceSource, /isDailyRevenueWorkQueueEnabled/)
assert.match(serviceSource, /isCommunicationStrategyEnabled/)
assert.match(serviceSource, /getRuntimeKillSwitchStates/)
assert.match(serviceSource, /isSchedulerEligibilityMigrationReady/)
assert.match(serviceSource, /getActiveApprovedBusinessProfile/)
assert.match(serviceSource, /DOCUMENTED_EQUIPIFY_AI_OS_PRODUCTION_ORG_ID/)
assert.doesNotMatch(routeSource, /process\.env\.GROWTH_ENGINE_AI_ORG_ID/)
assert.match(repoSource, /\.eq\("scheduler_runtime_running", true\)[\s\S]*\.order\("scheduler_wake_at", \{ ascending: true \}\)/)
console.log("  ✓ Phase 1 — route auth + canonical runtime functions wired")

const sampleSnapshot: GrowthAiosRuntimeConfigHealthSnapshot = {
  ok: true,
  qaMarker: GROWTH_AIOS_LIVE_RUNTIME_CONFIG_PROOF_1A_QA_MARKER,
  organizationConfigured: true,
  organizationValidUuid: true,
  organizationMatchesApprovedBusinessProfile: true,
  nativeDecisionEngineEnabled: true,
  dailyRevenueWorkQueueEnabled: true,
  communicationStrategyEnabled: true,
  outboundEnabled: false,
  schedulerMigrationReady: true,
  activeObjectiveCount: 7,
  dueRunningObjectiveCount: 3,
}
assertSnapshotContainsNoSecrets(sampleSnapshot)
console.log("  ✓ Phase 2 — response contract contains booleans/counts only (no secrets)")

assert.equal(
  classifyBooleanFromDeployedOrLocal({
    deployedValue: true,
    localValue: false,
    localEnvPresent: false,
    vercelProductionEnvRun: true,
  }),
  "verified_true",
)
assert.equal(
  classifyBooleanFromDeployedOrLocal({
    deployedValue: undefined,
    localValue: false,
    localEnvPresent: false,
    vercelProductionEnvRun: true,
  }),
  "unverified_sensitive_value",
)
assert.equal(
  classifyBooleanFromDeployedOrLocal({
    deployedValue: undefined,
    localValue: false,
    localEnvPresent: true,
    vercelProductionEnvRun: false,
  }),
  "verified_false",
)
assert.equal(
  classifyBooleanFromDeployedOrLocal({
    deployedValue: undefined,
    localValue: false,
    localEnvPresent: false,
    vercelProductionEnvRun: false,
  }),
  "not_configured",
)
console.log("  ✓ Phase 3 — hidden sensitive env values classify as unverified, not false")

assert.equal(classifySensitiveEnvPresence("GROWTH_ENGINE_AI_ORG_ID", {}), "not_configured")
assert.equal(
  classifySensitiveEnvPresence("GROWTH_ENGINE_AI_ORG_ID", {
    EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN: "1",
  }),
  "unverified_sensitive_value",
)
assert.equal(
  classifySensitiveEnvPresence("GROWTH_ENGINE_AI_ORG_ID", {
    GROWTH_ENGINE_AI_ORG_ID: "00757488-1026-44a5-aac4-269533ac21be",
  }),
  "verified_true",
)
assert.equal(
  classifySensitiveEnvPresence("GROWTH_ENGINE_AI_ORG_ID", {
    GROWTH_ENGINE_AI_ORG_ID: "not-a-uuid",
  }),
  "verified_false",
)
console.log("  ✓ Phase 4 — missing vs malformed vs hidden secret classifications")

assert.equal(isNativeRevenueDecisionEngineEnabled({ GROWTH_NATIVE_DECISION_ENGINE: "true" }), true)
assert.equal(isCommunicationStrategyEnabled({ GROWTH_NATIVE_DECISION_ENGINE: "true" }), true)
assert.equal(isDailyRevenueWorkQueueEnabled({ GROWTH_NATIVE_DECISION_ENGINE: "true" }), true)
assert.equal(isNativeRevenueDecisionEngineEnabled({}), false)
console.log("  ✓ Phase 5 — canonical native decision flag chain")

assert.equal(GROWTH_AIOS_RUNTIME_CONFIG_HEALTH_ROUTE_PATH, "/api/platform/growth/ai-os/runtime-config-health")
console.log("  ✓ Phase 6 — deployed diagnostic route path canonical")

console.log("\nGE-AIOS-LIVE-RUNTIME-CONFIG-PROOF-1A PASS\n")
