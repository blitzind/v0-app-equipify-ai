/**
 * GE-EI-IMP-4F — Email learning parity preview certification.
 * Run: pnpm test:growth-email-learning-parity-preview-cert
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  assertEmailLearningParityPreviewOutputHasNoPlaintextEmails,
  GROWTH_EMAIL_LEARNING_PARITY_PREVIEW_QA_MARKER,
  loadEmailLearningShadowLogFixture,
  parseEmailLearningShadowLogFixture,
  runEmailLearningParityPreview,
  type EmailLearningParityPreviewOutput,
} from "./email-learning-parity-preview"

function writeTempFile(name: string, contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "email-learning-parity-"))
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, contents, "utf8")
  return filePath
}

function assertOutputShape(output: EmailLearningParityPreviewOutput): void {
  assert.equal(output.qa_marker, GROWTH_EMAIL_LEARNING_PARITY_PREVIEW_QA_MARKER)
  assert.ok(output.mode === "fixture" || output.mode === "live")
  assert.ok(output.limit > 0)
  assert.ok(typeof output.reconstruction_summary.observations_created === "number")
  assert.ok(typeof output.reconstruction_summary.domains_discovered === "number")
  assert.ok(output.reconstruction_summary.sources)
  assert.ok(output.parity_report)
  assert.equal(output.parity_report.qa_marker, "growth-email-learning-parity-v1")
  assert.ok(typeof output.shadow_logs_loaded === "number")
  assert.ok(typeof output.shadow_logs_ignored === "number")
  assert.ok(Array.isArray(output.warnings))
}

async function main(): Promise<void> {
  console.log("\n=== GE-EI-IMP-4F Email Learning Parity Preview Certification ===\n")

  assert.equal(GROWTH_EMAIL_LEARNING_PARITY_PREVIEW_QA_MARKER, "growth-email-learning-parity-preview-v1")

  const fixture = await runEmailLearningParityPreview(["--fixture"])
  assertOutputShape(fixture)
  assert.equal(fixture.mode, "fixture")
  assert.ok(fixture.reconstruction_summary.observations_created > 0)
  assert.ok(fixture.shadow_logs_loaded > 0)
  assert.ok(fixture.parity_report.matched_count > 0)
  assert.ok(assertEmailLearningParityPreviewOutputHasNoPlaintextEmails(fixture))
  console.log("  ✓ Fixture mode produces valid JSON with reconstruction + parity")

  const fixtureRepeat = await runEmailLearningParityPreview(["--fixture", "--limit=250"])
  assert.deepEqual(fixture, fixtureRepeat, "fixture output must be deterministic")
  console.log("  ✓ Deterministic fixture output")

  const arrayFixture = parseEmailLearningShadowLogFixture(
    JSON.stringify([
      { shadow: "email_learning_observation", event_type: "sent", domain: "acme.com", source: "outbound_send" },
      { shadow: "noise", event_type: "ignored" },
    ]),
  )
  assert.equal(arrayFixture.loaded, 1)
  assert.equal(arrayFixture.ignored, 1)
  console.log("  ✓ Array shadow logs parsed; unrelated entries ignored")

  const ndjsonFixture = parseEmailLearningShadowLogFixture(
    [
      '{"shadow":"email_learning_observation","event_type":"opened","domain":"acme.com","source":"provider_webhook"}',
      '{"shadow":"recipient_email_confidence","label":"ignore-me"}',
      "not-json",
    ].join("\n"),
  )
  assert.equal(ndjsonFixture.loaded, 1)
  assert.ok(ndjsonFixture.ignored >= 2)
  console.log("  ✓ NDJSON shadow logs parsed; unrelated lines ignored")

  const missingFile = loadEmailLearningShadowLogFixture("/tmp/does-not-exist-email-learning-shadow.json")
  assert.equal(missingFile.loaded, 0)
  assert.ok(missingFile.warnings.some((warning) => warning.startsWith("shadow_fixture_not_found")))
  console.log("  ✓ Missing shadow fixture handled gracefully")

  const shadowFile = writeTempFile(
    "shadow.json",
    JSON.stringify([
      {
        shadow: "email_learning_observation",
        event_type: "sent",
        domain: "acme.com",
        source: "outbound_send",
        observation_id: "fixture-shadow-sent",
      },
    ]),
  )
  const withShadowFile = await runEmailLearningParityPreview(["--fixture", `--shadow-fixture=${shadowFile}`])
  assert.equal(withShadowFile.shadow_logs_loaded, 1)
  assert.ok(withShadowFile.parity_report.shadow_count >= 1)
  console.log("  ✓ External shadow fixture file loaded")

  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const liveMissing = await runEmailLearningParityPreview([])
    assertOutputShape(liveMissing)
    assert.equal(liveMissing.mode, "live")
    assert.ok(liveMissing.warnings.includes("supabase_credentials_missing"))
    assert.ok(liveMissing.warnings.includes("reconstruction_only"))
    assert.equal(liveMissing.shadow_logs_loaded, 0)
    assert.ok(assertEmailLearningParityPreviewOutputHasNoPlaintextEmails(liveMissing))
    console.log("  ✓ Live mode without credentials exits gracefully")
  } finally {
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL
    if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY
  }

  const subprocessOutput = execSync("tsx scripts/email-learning-parity-preview.ts --fixture", {
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  })
  const subprocessParsed = JSON.parse(subprocessOutput) as EmailLearningParityPreviewOutput
  assertOutputShape(subprocessParsed)
  assert.ok(assertEmailLearningParityPreviewOutputHasNoPlaintextEmails(subprocessParsed))
  console.log("  ✓ Subprocess fixture run works without Supabase credentials")

  console.log("\nGE-EI-IMP-4F email learning parity preview certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
