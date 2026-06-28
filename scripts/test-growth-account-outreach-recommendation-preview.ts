/**
 * GE-IRE-6E — Account Outreach Recommendation preview certification.
 * Run: pnpm test:growth-account-outreach-recommendation-preview
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execSync } from "node:child_process"
import { assertContactEngagementPreviewHasNoPlaintextEmails } from "../lib/growth/contact-verification/contact-engagement-prediction"
import {
  buildAccountOutreachPreviewFixtures,
  buildAccountOutreachPreviewOutput,
  GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_PREVIEW_QA_MARKER,
  loadAccountOutreachPreviewInput,
  runAccountOutreachPreview,
  type AccountOutreachPreviewOutput,
} from "./account-outreach-recommendation-preview"

function writeTempFile(name: string, contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "account-outreach-preview-"))
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, contents, "utf8")
  return filePath
}

function assertPreviewShape(output: AccountOutreachPreviewOutput): void {
  assert.equal(output.qa_marker, GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_PREVIEW_QA_MARKER)
  assert.ok(output.summary)
  assert.ok(output.committee)
  assert.ok(Array.isArray(output.backup_recommendations))
  assert.ok(Array.isArray(output.staged_plan))
  assert.ok(output.readiness)
  assert.ok(Array.isArray(output.warnings))
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-6E Account Outreach Preview Certification ===\n")

  const fixture = await runAccountOutreachPreview(["--fixture"])
  assertPreviewShape(fixture)
  assert.ok(fixture.summary.total_contacts >= 3)
  assert.ok(fixture.primary_recommendation)
  assert.ok(fixture.staged_plan.length >= 1)
  assert.ok(assertContactEngagementPreviewHasNoPlaintextEmails(fixture))
  console.log("  ✓ Preview fixture mode valid JSON")

  const fixtureRepeat = await runAccountOutreachPreview(["--fixture"])
  assert.deepEqual(fixture, fixtureRepeat)
  console.log("  ✓ Deterministic preview output")

  const inputFile = writeTempFile("account.json", JSON.stringify(buildAccountOutreachPreviewFixtures()))
  const fromFile = await runAccountOutreachPreview([`--input=${inputFile}`])
  assertPreviewShape(fromFile)
  assert.equal(fromFile.summary.total_contacts, fixture.summary.total_contacts)
  console.log("  ✓ Preview file input mode")

  const missing = loadAccountOutreachPreviewInput("/tmp/does-not-exist-account-outreach.json")
  assert.equal(missing.input, null)
  assert.ok(missing.warnings.some((warning) => warning.startsWith("preview_input_not_found")))
  console.log("  ✓ Missing input file handled gracefully")

  const direct = await buildAccountOutreachPreviewOutput(buildAccountOutreachPreviewFixtures())
  if (direct.primary_recommendation?.recommended_email_present) {
    assert.equal(direct.primary_recommendation.recommended_email_masked, "***@***")
  }
  console.log("  ✓ Privacy masking on primary email")

  const cliOutput = execSync("tsx scripts/account-outreach-recommendation-preview.ts --fixture", {
    cwd: process.cwd(),
    encoding: "utf8",
  })
  const jsonLine = cliOutput.trim().split("\n").find((line) => line.startsWith("{"))
  assert.ok(jsonLine)
  const cliJson = JSON.parse(jsonLine) as AccountOutreachPreviewOutput
  assertPreviewShape(cliJson)
  assert.ok(assertContactEngagementPreviewHasNoPlaintextEmails(cliJson))
  console.log("  ✓ CLI JSON-only output with privacy")

  console.log("\nGE-IRE-6E account outreach preview certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
