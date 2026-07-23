/**
 * FUZOR-SDK-1A — Stable Platform SDK validation.
 * Run: pnpm test:fuzor-sdk-1a-validation
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import {
  Configuration,
  Context,
  DecisionRecords,
  EventBus,
  FUZOR_SDK_PHASE,
  FUZOR_SDK_QA_MARKER,
  FUZOR_SDK_VERSION,
  Identity,
  Knowledge,
  Memory,
  Observability,
} from "@fuzor/sdk"

import {
  FUZOR_SDK_1A_SAMPLE_QA_MARKER,
  validateFuzorSdkSampleConsumer,
} from "../lib/growth/qa/fuzor-sdk-1a-sample-consumer"

const ROOT = process.cwd()
const FUZOR_ROOT = path.resolve(ROOT, "../../fuzor")

console.log(`[${FUZOR_SDK_PHASE}] Stable Platform SDK validation`)

assert.equal(FUZOR_SDK_QA_MARKER, "fuzor-sdk-1a-stable-platform-v1")
assert.equal(FUZOR_SDK_VERSION, "0.1.0")

assert.ok(Identity.PLATFORM_ACTOR_AGENTS.length > 0)
assert.ok(Configuration.PLATFORM_RUNTIME_PROFILE_VERSION)
assert.ok(Knowledge.PLATFORM_KNOWLEDGE_CENTER_QA_MARKER)
assert.ok(Memory.PLATFORM_MEMORY_REGISTRY_QA_MARKER)
assert.ok(Context.PLATFORM_CONTEXT_ASSEMBLY_QA_MARKER)
assert.ok(DecisionRecords.PLATFORM_DECISION_RECORD_QA_MARKER)
assert.ok(EventBus.PLATFORM_EVENT_QA_MARKER)
assert.ok(Observability.FUZOR_OBSERVABILITY_PHASE)

const sdkSource = fs.readFileSync(path.join(ROOT, "node_modules/@fuzor/sdk/dist/index.js"), "utf8")
assert.ok(sdkSource.includes("Identity"))
assert.ok(sdkSource.includes("DecisionRecords"))

const sample = validateFuzorSdkSampleConsumer()
assert.equal(sample.ok, true, `sample consumer failed: ${JSON.stringify(sample.checks.filter((c) => !c.pass))}`)
assert.equal(FUZOR_SDK_1A_SAMPLE_QA_MARKER, "fuzor-sdk-1a-sample-consumer-v1")

console.log(`[${FUZOR_SDK_PHASE}] product sample consumer PASS (Equipify / Insideify / Future)`)

execSync("npm run test -w @fuzor/sdk", { cwd: FUZOR_ROOT, stdio: "inherit" })
console.log(`[${FUZOR_SDK_PHASE}] @fuzor/sdk unit tests PASS`)

execSync("pnpm test:fuzor-production-certification-1a-integrated-platform", { cwd: ROOT, stdio: "inherit" })
console.log(`[${FUZOR_SDK_PHASE}] integrated platform regression PASS`)

console.log(`[${FUZOR_SDK_PHASE}] PASS`)
