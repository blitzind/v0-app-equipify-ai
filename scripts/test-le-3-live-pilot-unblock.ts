/**
 * LE-3 live pilot unblock certification — no Apollo HTTP, no DB required for most checks.
 * Run: pnpm test:le-3-live-pilot-unblock
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildApolloLivePilotDryRunReport } from "../lib/growth/apollo/apollo-live-pilot-dry-run"
import {
  APOLLO_LIVE_PILOT_TEST_COMPANY_SEED_QA_MARKER,
  APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER,
  buildApolloTestCompanyDedupeHash,
  normalizeApolloTestCompanyDomain,
  normalizeApolloTestCompanyWebsite,
  validateApolloLivePilotTestCompanySeedEnv,
} from "../lib/growth/apollo/apollo-live-pilot-test-company-seed"
import { validateLe2LiveEvidence } from "../lib/growth/live-execution/le-2-live-evidence-validation"

export const LE_3_LIVE_PILOT_UNBLOCK_QA_MARKER = "le-3-live-pilot-unblock-v1" as const

type CertResult = { id: string; status: "pass" | "fail"; detail: string }
const results: CertResult[] = []

function record(id: string, status: CertResult["status"], detail: string): void {
  results.push({ id, status, detail })
  console.log(`${status === "pass" ? "✓" : "✗"} ${id}: ${detail}`)
}

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-live-pilot-test-company-seed.ts",
  "scripts/seed-apollo-live-pilot-test-company.ts",
  "docs/LE_3_LIVE_PILOT_UNBLOCK.md",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  record(`file.${relativePath}`, "pass", "Present")
}

assert.equal(LE_3_LIVE_PILOT_UNBLOCK_QA_MARKER, "le-3-live-pilot-unblock-v1")
assert.equal(APOLLO_LIVE_PILOT_TEST_COMPANY_SEED_QA_MARKER, "apollo-live-pilot-test-company-seed-le-3-v1")
assert.equal(APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER, "apollo-live-pilot-test-company-le-3-v1")

console.log("\n=== LE-3 Seed ACK gate ===")
const noAck = validateApolloLivePilotTestCompanySeedEnv({
  APOLLO_TEST_COMPANY_NAME: "Test Co",
  APOLLO_TEST_COMPANY_DOMAIN: "example.com",
  APOLLO_TEST_COMPANY_WEBSITE: "https://example.com",
} as NodeJS.ProcessEnv)
assert.equal(noAck.ok, false)
assert.ok(noAck.errors.some((e) => e.includes("APOLLO_TEST_COMPANY_SEED_ACK")))
record("seed.requires_ack", "pass", "Seed blocked without APOLLO_TEST_COMPANY_SEED_ACK=1")

console.log("\n=== LE-3 Seed required fields ===")
const noName = validateApolloLivePilotTestCompanySeedEnv({
  APOLLO_TEST_COMPANY_SEED_ACK: "1",
  APOLLO_TEST_COMPANY_DOMAIN: "example.com",
} as NodeJS.ProcessEnv)
assert.equal(noName.ok, false)
record("seed.requires_name_domain", "pass", "Name/domain/website required")

const okEnv = validateApolloLivePilotTestCompanySeedEnv({
  APOLLO_TEST_COMPANY_SEED_ACK: "1",
  APOLLO_TEST_COMPANY_NAME: "Precision Biomedical Services",
  APOLLO_TEST_COMPANY_DOMAIN: "precisionbiomedicalservices.com",
  APOLLO_TEST_COMPANY_WEBSITE: "https://precisionbiomedicalservices.com",
} as NodeJS.ProcessEnv)
assert.equal(okEnv.ok, true)
assert.equal(normalizeApolloTestCompanyDomain("www.Example.COM"), "example.com")
assert.equal(
  normalizeApolloTestCompanyWebsite("example.com", "precisionbiomedicalservices.com"),
  "https://precisionbiomedicalservices.com",
)
record("seed.env_valid", "pass", "Valid seed env parses")

console.log("\n=== LE-3 Seed does not call Apollo ===")
const seedSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-live-pilot-test-company-seed.ts"),
  "utf8",
)
assert.doesNotMatch(seedSource, /apollo-client|mixed_people|runApolloLivePilot/)
record("seed.no_apollo_http", "pass", "Seed module has no Apollo HTTP imports")

console.log("\n=== LE-3 Dedupe hash stable ===")
assert.equal(
  buildApolloTestCompanyDedupeHash("precisionbiomedicalservices.com"),
  buildApolloTestCompanyDedupeHash("www.precisionbiomedicalservices.com"),
)
record("seed.dedupe", "pass", "Dedupe hash normalizes domain")

console.log("\n=== LE-3 Selector prefers seeded marker ===")
const selectorSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-live-pilot-test-company-selector.ts"),
  "utf8",
)
assert.match(selectorSource, /prefer_seeded/)
assert.match(selectorSource, /APOLLO_LIVE_PILOT_TEST_COMPANY_SOURCE_MARKER/)
record("selector.seeded", "pass", "Selector supports prefer_seeded")

console.log("\n=== LE-3 Dry-run remains no-API ===")
const dryRun = buildApolloLivePilotDryRunReport({ env: {} as NodeJS.ProcessEnv })
assert.equal(dryRun.will_call_apollo_api, false)
record("dry_run.no_api", "pass", "will_call_apollo_api=false")

console.log("\n=== LE-3 LE-2 validation stays strict ===")
const le2 = validateLe2LiveEvidence({ evidence: {} })
assert.equal(le2.final_verdict, "rejected")
record("le2.strict", "pass", "Missing live evidence still rejected")

const reportPath = path.join(process.cwd(), "docs/LE_3_LIVE_PILOT_UNBLOCK_CERTIFICATION_REPORT.md")
const table = results.map((r) => `| ${r.id} | ${r.status} | ${r.detail.replace(/\|/g, "\\|")} |`).join("\n")
fs.writeFileSync(
  reportPath,
  `# LE-3 Live Pilot Unblock Certification Report

Generated by \`pnpm test:le-3-live-pilot-unblock\` at ${new Date().toISOString()}.

| Outcome | Count |
|---------|-------|
| pass | ${results.filter((r) => r.status === "pass").length} |
| fail | ${results.filter((r) => r.status === "fail").length} |

See [LE_3_LIVE_PILOT_UNBLOCK.md](./LE_3_LIVE_PILOT_UNBLOCK.md).

| ID | Status | Detail |
|----|--------|--------|
${table}
`,
  "utf8",
)

const failures = results.filter((r) => r.status === "fail")
if (failures.length > 0) {
  console.error(`\nLE-3 certification failed: ${failures.length}`)
  process.exitCode = 1
} else {
  console.log(`\nLE-3 live pilot unblock certification passed.\nWrote ${reportPath}`)
}
