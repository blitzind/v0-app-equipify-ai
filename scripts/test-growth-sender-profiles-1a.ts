/**
 * GS-GROWTH-SIGNATURES-1A — sender profile API and repository contract tests.
 * Run: pnpm test:growth-sender-profiles-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_SENDER_PROFILES_QA_MARKER } from "../lib/growth/signatures/signature-types"

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function testMigrationExists() {
  const migration = readSource("supabase/migrations/20270922120000_growth_sender_profiles_foundation.sql")
  assert.match(migration, /growth\.sender_profiles/)
  assert.match(migration, /signature_template/)
  assert.match(migration, /mailbox_connection_id/)
  assert.match(migration, /sender_account_id/)
}

function testRepositoryContracts() {
  const repo = readSource("lib/growth/signatures/sender-profile-repository.ts")
  assert.match(repo, /createSenderProfile/)
  assert.match(repo, /updateSenderProfile/)
  assert.match(repo, /getSenderProfileBySenderAccountId/)
  assert.match(repo, /assignSenderProfileMailbox/)
  assert.match(repo, /sender_profile_already_exists/)
  assert.match(repo, /softDeleteSenderProfile/)
}

function testApiRoutes() {
  assert.match(readSource("app/api/platform/growth/sender-profiles/route.ts"), /createSenderProfile/)
  assert.match(readSource("app/api/platform/growth/sender-profiles/dashboard/route.ts"), /buildSenderProfilesDashboard/)
  assert.match(readSource("app/api/platform/growth/sender-profiles/[id]/preview/route.ts"), /renderSignatureFromProfile/)
  assert.match(readSource("app/api/platform/growth/sender-profiles/assign/route.ts"), /assignSenderProfileMailbox/)
}

function testApiRoutesNoWarmupLeak() {
  const assign = readSource("app/api/platform/growth/sender-profiles/assign/route.ts")
  assert.ok(!assign.includes("startWarmup"))
}

function testResolverMergeFields() {
  const mergeFields = readSource("lib/growth/signatures/sender-merge-fields.ts")
  assert.match(mergeFields, /buildSenderMergeFields/)
  assert.match(mergeFields, /sender\.first_name/)
  assert.match(mergeFields, /sender\.company/)
  const resolver = readSource("lib/growth/signatures/signature-resolver.ts")
  assert.match(resolver, /resolveOutboundSignatureForSender/)
  assert.match(resolver, /mailbox_profile/)
}

function testRuntimeWiringMarkers() {
  const runtime = readSource("lib/growth/signatures/outbound-signature-runtime.ts")
  assert.match(runtime, /prepareOutboundEmailContent/)
  const injection = readSource("lib/growth/signatures/signature-injection.ts")
  assert.match(injection, /growth-signature-injection-1b-v1/)
}

function testSignatureStatusDashboard() {
  const dashboard = readSource("lib/growth/signatures/sender-profiles-dashboard.ts")
  assert.match(dashboard, /signatureStatus/)
  const ui = readSource("components/growth/signatures/growth-email-signatures-panel.tsx")
  assert.match(ui, /GROWTH_SENDER_PROFILE_SIGNATURE_STATUS_LABELS/)
}

function testUiPanel() {
  const ui = readSource("components/growth/signatures/growth-email-signatures-panel.tsx")
  assert.match(ui, /GrowthEmailSignaturesPanel/)
  assert.match(ui, /sender-profiles\/dashboard/)
  assert.match(ui, /Sender Profiles/)
  assert.match(ui, /Signature Templates/)
  assert.equal(GROWTH_SENDER_PROFILES_QA_MARKER, "growth-sender-profiles-1a-v1")
}

function testProfileReassignment() {
  const repo = readSource("lib/growth/signatures/sender-profile-repository.ts")
  assert.match(repo, /sender_profile_sender_conflict/)
  assert.match(repo, /mailbox_connection_id/)
  assert.match(repo, /getSenderProfileByMailboxConnectionId/)
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "migration defines sender_profiles", fn: testMigrationExists },
  { name: "repository CRUD contracts", fn: testRepositoryContracts },
  { name: "API routes wired", fn: testApiRoutes },
  { name: "assign route isolated", fn: testApiRoutesNoWarmupLeak },
  { name: "signature resolver merge fields", fn: testResolverMergeFields },
  { name: "runtime wiring markers", fn: testRuntimeWiringMarkers },
  { name: "signature status dashboard", fn: testSignatureStatusDashboard },
  { name: "email signatures UI panel", fn: testUiPanel },
  { name: "profile reassignment guards", fn: testProfileReassignment },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed > 0) process.exit(1)
console.log(`\nAll ${tests.length} growth-sender-profiles-1a tests passed.`)
