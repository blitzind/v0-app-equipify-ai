/**
 * GE-IRE-6D — Buying Committee preview certification.
 * Run: pnpm test:growth-buying-committee-preview
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execSync } from "node:child_process"
import { assertContactEngagementPreviewHasNoPlaintextEmails } from "../lib/growth/contact-verification/contact-engagement-prediction"
import {
  buildBuyingCommitteePreviewFixtures,
  buildBuyingCommitteePreviewOutput,
  GROWTH_BUYING_COMMITTEE_PREVIEW_QA_MARKER,
  loadBuyingCommitteePreviewInput,
  runBuyingCommitteePreview,
  type BuyingCommitteePreviewOutput,
} from "./analyze-buying-committee-preview"

function writeTempFile(name: string, contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buying-committee-preview-"))
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, contents, "utf8")
  return filePath
}

function assertPreviewShape(output: BuyingCommitteePreviewOutput): void {
  assert.equal(output.qa_marker, GROWTH_BUYING_COMMITTEE_PREVIEW_QA_MARKER)
  assert.ok(output.summary)
  assert.ok(output.recommendation)
  assert.ok(output.coverage)
  assert.ok(Array.isArray(output.top_contacts))
  assert.ok(Array.isArray(output.warnings))
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-6D Buying Committee Preview Certification ===\n")

  const fixture = await runBuyingCommitteePreview(["--fixture"])
  assertPreviewShape(fixture)
  assert.ok(fixture.summary.total_contacts >= 3)
  assert.ok(fixture.top_contacts.length >= 1)
  assert.ok(fixture.recommendation.primary_contact)
  assert.ok(assertContactEngagementPreviewHasNoPlaintextEmails(fixture))
  console.log("  ✓ Preview fixture mode valid JSON")

  const fixtureRepeat = await runBuyingCommitteePreview(["--fixture"])
  assert.deepEqual(fixture, fixtureRepeat)
  console.log("  ✓ Deterministic preview output")

  const inputFile = writeTempFile("account.json", JSON.stringify(buildBuyingCommitteePreviewFixtures()))
  const fromFile = await runBuyingCommitteePreview([`--input=${inputFile}`])
  assertPreviewShape(fromFile)
  assert.equal(fromFile.summary.total_contacts, fixture.summary.total_contacts)
  console.log("  ✓ Preview file input mode")

  const missing = loadBuyingCommitteePreviewInput("/tmp/does-not-exist-buying-committee.json")
  assert.equal(missing.input, null)
  assert.ok(missing.warnings.some((warning) => warning.startsWith("preview_input_not_found")))
  console.log("  ✓ Missing input file handled gracefully")

  const direct = await buildBuyingCommitteePreviewOutput(buildBuyingCommitteePreviewFixtures())
  assert.ok(direct.top_contacts.every((row) => row.recommended_email_present === Boolean(row.recommended_email_masked)))
  console.log("  ✓ Engagement fields on top contacts")

  const cliOutput = execSync("tsx scripts/analyze-buying-committee-preview.ts --fixture", {
    cwd: process.cwd(),
    encoding: "utf8",
  })
  const jsonLine = cliOutput.trim().split("\n").find((line) => line.startsWith("{"))
  assert.ok(jsonLine)
  const cliJson = JSON.parse(jsonLine) as BuyingCommitteePreviewOutput
  assertPreviewShape(cliJson)
  assert.ok(assertContactEngagementPreviewHasNoPlaintextEmails(cliJson))
  console.log("  ✓ CLI JSON-only output with privacy")

  console.log("\nGE-IRE-6D buying committee preview certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
