/**
 * GE-AIOS-2D — Decision Record foundation certification.
 * Run: pnpm test:ge-aios-2d-decision-record-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { aiDecisionRegistryCatalog, lookupAiDecisionRegistryEntry } from "../lib/growth/aios/ai-decision-record-registry"
import { aiDecisionRecordSchemaCatalog } from "../lib/growth/aios/ai-decision-record-repository"
import {
  AI_DECISION_RECORD_RUNTIME_RULE,
  AI_DECISION_RECORD_SCHEMA_VERSION,
  GROWTH_AIOS_2D_PHASE,
  GROWTH_AI_DECISION_RECORD_QA_MARKER,
  GROWTH_AI_DECISION_RECORD_SCHEMA_MIGRATION,
  clampDecisionConfidence,
  normalizeEvidenceBundle,
} from "../lib/growth/aios/ai-decision-record-types"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_2D_PHASE}] Decision Record foundation certification`)

assert.equal(GROWTH_AI_DECISION_RECORD_QA_MARKER, "growth-aios-2d-decision-record-v1")
assert.equal(GROWTH_AI_DECISION_RECORD_SCHEMA_MIGRATION, "20271001150000_growth_aios_2d_decision_records.sql")
assert.equal(AI_DECISION_RECORD_SCHEMA_VERSION, "1.0")
assert.equal(clampDecisionConfidence(150), 100)
assert.equal(normalizeEvidenceBundle([{ evidenceKey: "lead.score" }]).length, 1)

const verifyEmail = lookupAiDecisionRegistryEntry("verify_email")
assert.ok(verifyEmail)
assert.equal(verifyEmail?.ownerAgent, "qualification")

const migration = readSource(`supabase/migrations/${GROWTH_AI_DECISION_RECORD_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("growth.ai_decision_records"))
assert.ok(migration.includes("growth.ai_decision_record_audit_events"))
assert.ok(migration.includes("evidence_bundle"))
assert.ok(migration.includes("supersedes_decision_id"))
assert.ok(migration.includes("expected_value_usd"))
assert.equal(migration.includes("grant update on table growth.ai_decision_records"), false)
assert.equal(migration.includes("grant delete on table growth.ai_decision_records"), false)

const serviceSource = readSource("lib/growth/aios/ai-decision-record-service.ts")
for (const pattern of ["openai", "anthropic", "apollo", "pdl", "llm", "next-best-action", "executive-brain"]) {
  assert.equal(serviceSource.toLowerCase().includes(pattern), false, `service must not reference ${pattern}`)
}
assert.ok(serviceSource.includes("@fuzor/decision-records"))
assert.equal(serviceSource.includes("computeGrowthLeadNextBestAction"), false)

const repositorySource = readSource("lib/growth/aios/ai-decision-record-repository.ts")
assert.ok(repositorySource.includes("@fuzor/decision-records"))

const decisionFiles = [
  "lib/growth/aios/ai-decision-record-types.ts",
  "lib/growth/aios/ai-decision-record-registry.ts",
  "lib/growth/aios/ai-decision-record-repository.ts",
  "lib/growth/aios/ai-decision-record-service.ts",
  "lib/growth/aios/ai-decision-record-schema-health.ts",
]
for (const file of decisionFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(AI_DECISION_RECORD_RUNTIME_RULE.includes("do not invoke AI"))
assert.ok(lookupAiEventRegistryEntry("decision.recorded"))
assert.ok(lookupAiEventRegistryEntry("decision.superseded"))

assert.ok(aiDecisionRegistryCatalog().count >= 10)
assert.equal(aiDecisionRecordSchemaCatalog().qaMarker, GROWTH_AI_DECISION_RECORD_QA_MARKER)

console.log(`[${GROWTH_AIOS_2D_PHASE}] PASS — Decision Record foundation certified (local)`)
