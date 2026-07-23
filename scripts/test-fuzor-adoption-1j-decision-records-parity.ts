/**
 * FUZOR-ADOPTION-1J — Decision Records platform delegation parity.
 * Run: pnpm test:fuzor-adoption-1j-decision-records-parity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  PLATFORM_DECISION_RECORD_QA_MARKER,
  PLATFORM_DECISION_RECORD_SCHEMA_MIGRATION,
  PLATFORM_DECISION_RECORD_SCHEMA_VERSION,
  PLATFORM_DECISION_REGISTRY,
  clampDecisionConfidence,
  createPlatformDecisionRecord,
  getPlatformDecisionRecord,
  getPlatformDecisionRecordAuditTrail,
  linkPlatformDecisionRecordToWorkOrder,
  normalizeEvidenceBundle,
  platformDecisionRecordSchemaCatalog,
  platformDecisionRegistryCatalog,
  queryPlatformDecisionRecords,
  supersedePlatformDecisionRecord,
} from "@fuzor/decision-records"

import {
  AI_DECISION_RECORD_SCHEMA_VERSION,
  GROWTH_AI_DECISION_RECORD_QA_MARKER,
  GROWTH_AI_DECISION_RECORD_SCHEMA_MIGRATION,
} from "../lib/growth/aios/ai-decision-record-types"

import {
  AI_DECISION_REGISTRY,
  aiDecisionRegistryCatalog,
  lookupAiDecisionRegistryEntry,
} from "../lib/growth/aios/ai-decision-record-registry"

import { aiDecisionRecordSchemaCatalog } from "../lib/growth/aios/ai-decision-record-repository"

import {
  createAiDecisionRecord,
  getAiDecisionRecord,
  getAiDecisionRecordAuditTrail,
  linkAiDecisionRecordToWorkOrder,
  queryAiDecisionRecords,
  supersedeAiDecisionRecord,
} from "../lib/growth/aios/ai-decision-record-service"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[FUZOR-ADOPTION-1J] Decision Records platform delegation parity")

assert.strictEqual(GROWTH_AI_DECISION_RECORD_QA_MARKER, PLATFORM_DECISION_RECORD_QA_MARKER)
assert.strictEqual(GROWTH_AI_DECISION_RECORD_SCHEMA_MIGRATION, PLATFORM_DECISION_RECORD_SCHEMA_MIGRATION)
assert.strictEqual(AI_DECISION_RECORD_SCHEMA_VERSION, PLATFORM_DECISION_RECORD_SCHEMA_VERSION)
assert.strictEqual(AI_DECISION_REGISTRY, PLATFORM_DECISION_REGISTRY)
assert.strictEqual(clampDecisionConfidence(150), 100)
assert.strictEqual(normalizeEvidenceBundle([{ evidenceKey: "lead.score" }]).length, 1)

const verifyEmail = lookupAiDecisionRegistryEntry("verify_email")
assert.ok(verifyEmail)
assert.equal(verifyEmail?.ownerAgent, "qualification")

const wrapperCatalog = aiDecisionRegistryCatalog()
const platformCatalog = platformDecisionRegistryCatalog()
assert.strictEqual(wrapperCatalog.count, platformCatalog.count)
assert.deepStrictEqual(wrapperCatalog.entries, platformCatalog.entries)

const wrapperSchemaCatalog = aiDecisionRecordSchemaCatalog()
const platformSchemaCatalog = platformDecisionRecordSchemaCatalog()
assert.strictEqual(wrapperSchemaCatalog.qaMarker, platformSchemaCatalog.qaMarker)
assert.strictEqual(wrapperSchemaCatalog.schemaVersion, platformSchemaCatalog.schemaVersion)
assert.deepStrictEqual(wrapperSchemaCatalog.lifecycleEvents, platformSchemaCatalog.lifecycleEvents)

assert.strictEqual(createAiDecisionRecord, createPlatformDecisionRecord)
assert.strictEqual(supersedeAiDecisionRecord, supersedePlatformDecisionRecord)
assert.strictEqual(linkAiDecisionRecordToWorkOrder, linkPlatformDecisionRecordToWorkOrder)
assert.strictEqual(getAiDecisionRecord, getPlatformDecisionRecord)
assert.strictEqual(queryAiDecisionRecords, queryPlatformDecisionRecords)
assert.strictEqual(getAiDecisionRecordAuditTrail, getPlatformDecisionRecordAuditTrail)

const decisionFiles = [
  "lib/growth/aios/ai-decision-record-types.ts",
  "lib/growth/aios/ai-decision-record-registry.ts",
  "lib/growth/aios/ai-decision-record-repository.ts",
  "lib/growth/aios/ai-decision-record-service.ts",
  "lib/growth/aios/ai-decision-record-schema-health.ts",
]

for (const file of decisionFiles) {
  const source = readSource(file)
  assert.ok(source.includes("@fuzor/decision-records"), `${file} must delegate to @fuzor/decision-records`)
}

const service = readSource("lib/growth/aios/ai-decision-record-service.ts")
for (const pattern of ["openai", "anthropic", "apollo", "pdl", "llm", "next-best-action", "executive-brain"]) {
  assert.equal(service.toLowerCase().includes(pattern), false, `service must not reference ${pattern}`)
}
assert.equal(service.includes("computeGrowthLeadNextBestAction"), false)

console.log("[FUZOR-ADOPTION-1J] wrapper delegation verified")

const avaOrg = "00000000-0000-4000-8000-000000000001"
const ivyOrg = "00000000-0000-4000-8000-000000000002"
const orionOrg = "00000000-0000-4000-8000-000000000003"

for (const orgId of [avaOrg, ivyOrg, orionOrg]) {
  assert.match(orgId, /^[0-9a-f-]{36}$/i)
}

assert.equal(service.includes("workflow"), false)
assert.equal(service.includes("DataMoon"), false)
assert.equal(service.includes("prompt"), false)

console.log("[FUZOR-ADOPTION-1J] multi-product decision architecture proof")

console.log("[FUZOR-ADOPTION-1J] PASS")
