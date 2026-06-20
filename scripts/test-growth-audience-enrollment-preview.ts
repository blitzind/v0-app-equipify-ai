/**
 * GS-RG-2C — Enrollment preview certification (local static).
 * Run: pnpm test:growth-audience-enrollment-preview
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUDIENCE_ENROLLMENT_PREVIEW_CATEGORIES,
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_2C_SCHEMA_MIGRATION,
  GROWTH_AUDIENCE_QA_MARKER,
} from "../lib/growth/audiences/growth-audience-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2C Enrollment Preview Certification ===\n")

  assert.equal(GROWTH_AUDIENCE_QA_MARKER, "growth-dynamic-audiences-gs-rg-2c-v1")
  assert.equal(GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_PREVIEW_MEMBERS, 10_000)
  assert.equal(GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_PREVIEW_BATCH, 500)
  assert.deepEqual([...GROWTH_AUDIENCE_ENROLLMENT_PREVIEW_CATEGORIES], [
    "eligible",
    "already_enrolled",
    "suppressed",
    "missing_contact",
    "blocked_by_limits",
  ])

  const migration = readSource(`supabase/migrations/${GROWTH_AUDIENCE_2C_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth_audience_enrollment_previews/)
  assert.match(migration, /growth_audience_enrollment_preview_members/)
  assert.match(migration, /eligible_count/)
  assert.match(migration, /audience_preview_enabled/)

  const readiness = readSource("lib/growth/audiences/growth-audience-enrollment-readiness.ts")
  assert.match(readiness, /classifyAudienceMemberEnrollmentReadiness/)
  assert.match(readiness, /runSequenceEnrollmentPreflight/)
  assert.doesNotMatch(readiness, /enrich/)

  const previewService = readSource("lib/growth/audiences/growth-audience-enrollment-preview-service.ts")
  assert.match(previewService, /startAudienceEnrollmentPreview/)
  assert.match(previewService, /processAudienceEnrollmentPreviewBatch/)
  assert.doesNotMatch(previewService, /setInterval/)

  const repository = readSource("lib/growth/audiences/growth-audience-enrollment-repository.ts")
  assert.match(repository, /\.order\("created_at", \{ ascending: true \}\)\s*\n\s*\.order\("id", \{ ascending: true \}\)/)

  console.log("  ✓ Preview engine with eligibility categories")
  console.log("  ✓ Stable preview member pagination (created_at, id)")
  console.log("\nGS-RG-2C enrollment preview certification passed.\n")
}

main()
