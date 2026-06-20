/**
 * GS-RG-2A — Audience enrollment certification (local static).
 * Run: pnpm test:growth-audience-enrollment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AUDIENCE_LIMITS } from "../lib/growth/audiences/growth-audience-config"
import { GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS } from "../lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2A Audience Enrollment Certification ===\n")

  assert.equal(GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_RUN, GROWTH_SEQUENCE_BULK_ENROLL_MAX_LEADS)

  const enrollment = readSource("lib/growth/audiences/growth-audience-enrollment-service.ts")
  assert.match(enrollment, /bulkEnrollLeadsInGrowthSequence/)
  assert.match(enrollment, /consumeAudienceEnrollmentBudget/)
  assert.match(enrollment, /sequencePatternId/)

  const enrollRoute = readSource("app/api/platform/growth/audiences/[audienceId]/enroll/route.ts")
  assert.match(enrollRoute, /enrollAudienceMembersInSequence/)

  const detail = readSource("components/growth/audiences/growth-audience-detail.tsx")
  assert.match(detail, /GrowthBulkSequenceEnrollmentDialog/)
  assert.match(detail, /Enroll Selected/)
  assert.match(detail, /Enroll All/)
  assert.doesNotMatch(detail, /setInterval/)

  console.log("  ✓ Reuses pattern bulk enrollment — no parallel system")
  console.log("\nGS-RG-2A audience enrollment certification passed.\n")
}

main()
