/**
 * Apollo live pilot production route certification — no live Apollo HTTP in CI.
 * Run: pnpm test:apollo-live-pilot-production-route
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM,
  APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER,
  assertApolloLivePilotProductionExecuteAllowed,
  assertApolloLivePilotProductionResponseHasNoSecrets,
  redactApolloLivePilotProductionSecrets,
  validateApolloLivePilotProductionExecuteConfirmation,
  buildApolloLivePilotProductionReadinessPayload,
} from "../lib/growth/apollo/apollo-live-pilot-production-route-gates"

export const APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_CERT_QA_MARKER =
  "apollo-live-pilot-production-route-cert-v1" as const

type CertResult = { id: string; status: "pass" | "fail"; detail: string }
const results: CertResult[] = []

function record(id: string, status: CertResult["status"], detail: string): void {
  results.push({ id, status, detail })
  console.log(`${status === "pass" ? "✓" : "✗"} ${id}: ${detail}`)
}

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-live-pilot-production-route-gates.ts",
  "lib/growth/apollo/apollo-live-pilot-production-route.ts",
  "app/api/platform/growth/apollo-live-pilot/readiness/route.ts",
  "app/api/platform/growth/apollo-live-pilot/execute/route.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "pass", "Present")
}

assert.equal(APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER, "apollo-live-pilot-production-route-v1")
assert.equal(APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM, "RUN_APOLLO_LIVE_PILOT")

console.log("\n=== Route protection (static) ===")
const readinessRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-live-pilot/readiness/route.ts"),
  "utf8",
)
const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-live-pilot/execute/route.ts"),
  "utf8",
)
assert.match(readinessRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /requireGrowthEnginePlatformAccess/)
assert.match(executeRoute, /validateApolloLivePilotProductionExecuteConfirmation/)
assert.match(executeRoute, /executeApolloLivePilotInProduction/)
record("route.platform_admin", "pass", "Both routes require platform admin access")

console.log("\n=== Confirmation gate ===")
const noBody = validateApolloLivePilotProductionExecuteConfirmation(null)
assert.equal(noBody.ok, false)
record("confirm.body_required", "pass", "Missing body rejected")

const wrongConfirm = validateApolloLivePilotProductionExecuteConfirmation({ confirm: "yes" })
assert.equal(wrongConfirm.ok, false)
record("confirm.exact_token", "pass", "Wrong confirm token rejected")

const okConfirm = validateApolloLivePilotProductionExecuteConfirmation({
  confirm: APOLLO_LIVE_PILOT_PRODUCTION_EXECUTE_CONFIRM,
})
assert.equal(okConfirm.ok, true)
record("confirm.accepts_token", "pass", "RUN_APOLLO_LIVE_PILOT accepted")

console.log("\n=== Execute gates (mock / missing env) ===")
const emptyEnv = {} as NodeJS.ProcessEnv
const blocked = assertApolloLivePilotProductionExecuteAllowed(emptyEnv)
assert.equal(blocked.ok, false)
assert.ok(blocked.blockers.length >= 5)
assert.ok(blocked.blockers.some((b) => b.includes("GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED")))
assert.ok(blocked.blockers.some((b) => b.includes("GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID")))
record("gates.empty_env", "pass", "Empty env blocked with multiple gate failures")

const mockEnv = {
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_USE_MOCK: "true",
  GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
  GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED: "true",
  GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID: "ad4f77c7-e91a-494a-8cb8-44fa23533087",
  APOLLO_API_KEY: "sk-test-should-not-appear-in-output",
} as NodeJS.ProcessEnv
const mockBlocked = assertApolloLivePilotProductionExecuteAllowed(mockEnv)
assert.equal(mockBlocked.ok, false)
assert.ok(mockBlocked.blockers.some((b) => b.includes("GROWTH_APOLLO_USE_MOCK")))
record("gates.mock_refused", "pass", "Mock mode refused even with other gates set")

const killSwitchEnv = {
  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
  GROWTH_APOLLO_USE_MOCK: "false",
  GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
  GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED: "true",
  GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID: "ad4f77c7-e91a-494a-8cb8-44fa23533087",
  GROWTH_DISCOVERY_DISABLE_APOLLO: "1",
  APOLLO_API_KEY: "sk-test-should-not-appear-in-output",
} as NodeJS.ProcessEnv
const killBlocked = assertApolloLivePilotProductionExecuteAllowed(killSwitchEnv)
assert.equal(killBlocked.ok, false)
assert.ok(killBlocked.blockers.some((b) => b.includes("kill switch")))
record("gates.kill_switch", "pass", "Kill switch blocks execute")

console.log("\n=== Readiness payload (no secrets) ===")
const readiness = buildApolloLivePilotProductionReadinessPayload(emptyEnv)
assert.equal(readiness.qa_marker, APOLLO_LIVE_PILOT_PRODUCTION_ROUTE_QA_MARKER)
assert.equal(readiness.readiness.api_key.configured, false)
assert.equal(readiness.safety.outreach_triggered_by_pilot, false)
const readinessJson = JSON.stringify(readiness)
assert.ok(!readinessJson.includes("sk-test"))
assertApolloLivePilotProductionResponseHasNoSecrets(readinessJson)
record("readiness.no_secrets", "pass", "Readiness payload omits secret values")

console.log("\n=== Redaction helper ===")
const redacted = redactApolloLivePilotProductionSecrets({
  APOLLO_API_KEY: "sk-live-secret",
  nested: { GROWTH_APOLLO_API_KEY: "sk-other" },
  safe: "ok",
})
assert.equal((redacted as Record<string, unknown>).APOLLO_API_KEY, "[REDACTED]")
assert.equal(
  ((redacted as Record<string, unknown>).nested as Record<string, unknown>).GROWTH_APOLLO_API_KEY,
  "[REDACTED]",
)
record("redaction.keys", "pass", "Known secret keys redacted")

console.log("\n=== Execute route does not log API key ===")
assert.doesNotMatch(executeRoute, /APOLLO_API_KEY/)
assert.doesNotMatch(executeRoute, /logGrowthEngine\([^)]*env/)
record("execute.no_secret_logging", "pass", "Execute route avoids APOLLO_API_KEY in source")

const pass = results.filter((r) => r.status === "pass").length
const fail = results.filter((r) => r.status === "fail").length
console.log(`\nCertification: ${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
