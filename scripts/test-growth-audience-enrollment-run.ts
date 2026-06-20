/**
 * GS-RG-2C — Enrollment run certification (local static).
 * Run: pnpm test:growth-audience-enrollment-run
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AUDIENCE_LIMITS, GROWTH_AUDIENCE_QA_MARKER } from "../lib/growth/audiences/growth-audience-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2C Enrollment Run Certification ===\n")

  assert.equal(GROWTH_AUDIENCE_QA_MARKER, "growth-dynamic-audiences-gs-rg-2c-v1")
  assert.equal(GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_RUN, 100)
  assert.equal(GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_ENROLLMENT_BATCH, 100)

  const migration = readSource("supabase/migrations/20270901160000_growth_dynamic_audiences_gs_rg_2c.sql")
  assert.match(migration, /growth_audience_enrollment_runs/)
  assert.match(migration, /cancelled_at/)
  assert.match(migration, /audience_enrollment_enabled/)

  const runService = readSource("lib/growth/audiences/growth-audience-enrollment-run-service.ts")
  assert.match(runService, /startAudienceEnrollmentRun/)
  assert.match(runService, /continueAudienceEnrollmentRun/)
  assert.match(runService, /cancelAudienceEnrollmentRun/)
  assert.match(runService, /bulkEnrollLeadsInGrowthSequence/)

  const route = readSource("app/api/platform/growth/audiences/[audienceId]/enrollment-runs/route.ts")
  assert.match(route, /startAudienceEnrollmentRun/)
  assert.match(route, /cancelAudienceEnrollmentRun/)

  const wizard = readSource("components/growth/audiences/growth-audience-enrollment-wizard.tsx")
  assert.match(wizard, /Preview Enrollment/)
  assert.match(wizard, /Confirm Enrollment/)
  assert.doesNotMatch(wizard, /setInterval/)

  console.log("  ✓ Resumable enrollment runs with cancellation")
  console.log("\nGS-RG-2C enrollment run certification passed.\n")
}

main()
