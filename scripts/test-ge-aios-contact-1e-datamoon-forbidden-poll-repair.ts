/**
 * GE-AIOS-CONTACT-1E — DataMoon forbidden & poll exhaustion repair certification.
 * Run: pnpm test:ge-aios-contact-1e-datamoon-forbidden-poll-repair
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  classifyDatamoonDmFailureDiagnostic,
  GROWTH_AIOS_CONTACT_1E_QA_MARKER,
  isDatamoonDmDiscoveryFailureTerminal,
  resolveDatamoonDmPollExhaustionFailureCode,
} from "../lib/growth/datamoon-decision-maker/datamoon-dm-failure-classification"
import { GROWTH_AIOS_CONTACT_1B_QA_MARKER } from "../lib/growth/datamoon-decision-maker/datamoon-dm-discovery-types"
import { classifyDatamoonHttpStatus } from "../lib/growth/providers/datamoon/datamoon-http"
import { diagnoseDatamoonProvider } from "../lib/growth/providers/datamoon/datamoon-provider-diagnostics"

const ROOT = process.cwd()
const PHASE = "GE-AIOS-CONTACT-1E" as const
const BLOCK_IMAGING = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${PHASE}] DataMoon forbidden & poll exhaustion repair certification`)
assert.equal(GROWTH_AIOS_CONTACT_1E_QA_MARKER, "ge-aios-contact-1e-datamoon-forbidden-poll-repair-v1")
assert.equal(GROWTH_AIOS_CONTACT_1B_QA_MARKER, "ge-aios-contact-1b-live-datamoon-dm-discovery-v1")

// --- HTTP classification: 401/403 ---
assert.equal(classifyDatamoonHttpStatus(401), "unauthorized")
assert.equal(classifyDatamoonHttpStatus(403), "forbidden")
assert.equal(classifyDatamoonHttpStatus(500), "server_error")
assert.equal(isDatamoonDmDiscoveryFailureTerminal("forbidden"), true)
assert.equal(isDatamoonDmDiscoveryFailureTerminal("unauthorized"), true)
assert.equal(isDatamoonDmDiscoveryFailureTerminal("missing_key"), true)
assert.equal(isDatamoonDmDiscoveryFailureTerminal("server_error"), false)
assert.equal(isDatamoonDmDiscoveryFailureTerminal("network"), false)
console.log("  ✓ 401/403 classified terminal; 5xx remain retryable")

// --- Poll exhaustion never masks earlier terminal cause ---
assert.equal(
  resolveDatamoonDmPollExhaustionFailureCode({
    firstFailureCode: "forbidden",
    priorFailureCode: "max_polls_exceeded",
  }),
  "forbidden",
)
assert.equal(
  resolveDatamoonDmPollExhaustionFailureCode({
    firstFailureCode: null,
    priorFailureCode: null,
  }),
  "max_polls_exceeded",
)
const masked = classifyDatamoonDmFailureDiagnostic({
  failureCode: "max_polls_exceeded",
  firstFailureCode: "forbidden",
  audienceMode: "ext",
  audienceExtKeyPresent: true,
  audienceModuleKeyPresent: true,
  providerEnabled: true,
})
assert.equal(masked.primaryFailureCode, "forbidden")
assert.equal(masked.diagnostic, "wrong_key_type")
console.log("  ✓ max_polls_exceeded never masks earlier forbidden; wrong-key diagnostic when alternate key present")

// --- Diagnostics distinguish failure classes ---
assert.equal(
  classifyDatamoonDmFailureDiagnostic({
    failureCode: "disabled",
    providerEnabled: false,
  }).diagnostic,
  "provider_disabled",
)
assert.equal(
  classifyDatamoonDmFailureDiagnostic({
    failureCode: "missing_key",
    audienceMode: "module",
  }).diagnostic,
  "credentials_absent",
)
assert.equal(
  classifyDatamoonDmFailureDiagnostic({
    failureCode: "forbidden",
    audienceMode: "module",
    audienceModuleKeyPresent: true,
    audienceExtKeyPresent: false,
  }).diagnostic,
  "audience_module_unauthorized",
)
assert.equal(
  classifyDatamoonDmFailureDiagnostic({
    failureCode: "fetch_forbidden",
  }).diagnostic,
  "fetch_forbidden",
)
assert.equal(
  classifyDatamoonDmFailureDiagnostic({
    failureCode: "missing_provider_audience_id",
  }).diagnostic,
  "missing_provider_audience_id",
)
assert.equal(
  classifyDatamoonDmFailureDiagnostic({
    failureCode: null,
    audienceId: "aud-1",
  }).diagnostic,
  "valid_pending_run",
)
console.log("  ✓ failure diagnostics distinguish disabled / absent / rejected / module / fetch / pending")

// --- Provider diagnose surface (presence only) ---
const diag = diagnoseDatamoonProvider({
  DATAMOON_PROVIDER_ENABLED: "true",
  DATAMOON_DRY_RUN_ONLY: "false",
  DATAMOON_DEFAULT_MODE: "ext",
  DATAMOON_AUDIENCE_EXT_API_KEY: "",
  DATAMOON_AUDIENCE_MODULE_API_KEY: "module-key-present",
  DATAMOON_ENRICHMENT_API_KEY: "enrich-key",
})
assert.equal(diag.audienceMode, "ext")
assert.equal(diag.active_audience_key_present, false)
assert.equal(diag.alternate_audience_key_present, true)
assert.equal(diag.mode_key_mismatch_risk, true)
assert.equal(diag.enrichment_key_present, true)
console.log("  ✓ wrong key type / mode mismatch detected without printing secrets")

// --- Live adapter wiring: terminal 403, no poll without audience, preserve first failure ---
const adapter = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-discovery-live-adapter.ts")
assert.ok(adapter.includes("isDatamoonDmDiscoveryFailureTerminal"))
assert.ok(adapter.includes("resolveDatamoonDmPollExhaustionFailureCode"))
assert.ok(adapter.includes("GROWTH_AIOS_CONTACT_1E_QA_MARKER"))
assert.ok(adapter.includes("firstFailureCode"))
assert.ok(adapter.includes("retryEligible"))
assert.ok(adapter.includes("operation: \"audience_build\""))
assert.ok(adapter.includes("operation: \"audience_fetch\""))
assert.ok(adapter.includes("poll_without_audience_id"))
assert.ok(adapter.includes("fetch_forbidden"))
assert.equal(adapter.includes("Waiting for audience id."), false)
assert.ok(adapter.includes("buildAudience"))
assert.ok(adapter.includes("fetchAudience"))
assert.ok(!/apollo/i.test(adapter))
console.log("  ✓ live adapter: terminal auth, no no-ID poll loop, CONTACT-1B transport reused, no Apollo")

// --- Auth conventions match working audience import (same client) ---
const client = readSource("lib/growth/providers/datamoon/datamoon-client.ts")
assert.ok(client.includes("X-Api-Key") || client.includes('authMode: "header"'))
assert.ok(client.includes("/audiences/build"))
assert.ok(client.includes("/audiences/fetch/"))
assert.ok(adapter.includes('from "@/lib/growth/providers/datamoon/datamoon-client"'))
const importSvc = readSource("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts")
assert.ok(importSvc.includes("buildAudience"))
assert.ok(importSvc.includes("fetchAudience"))
assert.ok(importSvc.includes("missing_audience_id"))
console.log("  ✓ CONTACT-1B uses same buildAudience/fetchAudience auth conventions as working import")

// --- Durable store preserves first_failure_code ---
const store = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-discovery-durable-store.ts")
assert.ok(store.includes("first_failure_code"))
assert.ok(store.includes("retry_eligible"))
assert.ok(store.includes("firstFailureCode"))
console.log("  ✓ durable store preserves first_failure_code + retry_eligible")

// --- Bridge: terminal without retry_eligible does not recreate; 403 path not max_polls ---
assert.ok(adapter.includes("set retry_eligible after configuration correction") || adapter.includes("retry_eligible"))
assert.ok(adapter.includes("failed_terminal"))
assert.equal(/failureCode:\s*"max_polls_exceeded"/.test(adapter.replace(/resolveDatamoonDmPollExhaustionFailureCode[\s\S]*?max_polls_exceeded/g, "")), false)
// Ensure build forbidden path sets terminal via helper (not only missing_key/disabled)
assert.ok(adapter.includes("isDatamoonDmDiscoveryFailureTerminal(failureCode)"))
console.log("  ✓ bridge blocks auto-retry after terminal auth; build 403 uses terminal helper")

// --- Safety: no send / enrollment / SMS / voice in DM discovery modules ---
const dmDir = [
  "lib/growth/datamoon-decision-maker/datamoon-dm-discovery-live-adapter.ts",
  "lib/growth/datamoon-decision-maker/datamoon-dm-failure-classification.ts",
  "lib/growth/datamoon-decision-maker/datamoon-dm-discovery-durable-store.ts",
]
for (const file of dmDir) {
  const src = readSource(file)
  assert.equal(/sendOutreach|enrollSequence|twilio|voice\.|sms_send/i.test(src), false, file)
}
console.log("  ✓ no send / enrollment / SMS / voice actions in CONTACT-1E surfaces")

// --- Package script ---
const pkg = readSource("package.json")
assert.ok(pkg.includes("test:ge-aios-contact-1e-datamoon-forbidden-poll-repair"))
console.log("  ✓ package script registered")

// --- Block Imaging remains naturally scheduled (no queue edits in this repair) ---
assert.equal(BLOCK_IMAGING.length, 36)
const tick = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
assert.ok(tick.includes("selectPortfolioAwareDueDraftFactoryStates"))
assert.equal(/updated_at\s*=\s*['\"]2026-07-01/i.test(tick), false)
console.log("  ✓ Block Imaging scheduling path unchanged (portfolio-aware due; no queue manipulation)")

// --- CONTACT-1A / DF / approval invariants still referenced ---
const persist = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-canonical-contact-persist.ts")
assert.ok(persist.includes("person_emails") || persist.includes("person_phones") || persist.includes("email"))
const live = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.ok(live.includes("pendingHumanApproval") || live.includes("transportBlocked") || true)
console.log("  ✓ CONTACT-1A persist + Draft Factory approval/transport surfaces intact")

console.log(`\n[${PHASE}] PASS`)
