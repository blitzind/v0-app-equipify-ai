/**
 * GS-RG-2C — Enrollment observability certification (local static).
 * Run: pnpm test:growth-audience-enrollment-observability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2C Enrollment Observability Certification ===\n")

  const observability = readSource("lib/growth/audiences/growth-audience-observability.ts")
  assert.match(observability, /previewsGeneratedToday/)
  assert.match(observability, /membersEvaluatedToday/)
  assert.match(observability, /membersEnrolledToday/)

  const dashboard = readSource("components/growth/growth-runtime-observability-dashboard.tsx")
  assert.match(dashboard, /previewsGeneratedToday/)
  assert.match(dashboard, /membersEvaluatedToday/)
  assert.doesNotMatch(dashboard, /setInterval/)

  console.log("  ✓ Runtime dashboard extended for enrollment preview metrics")
  console.log("\nGS-RG-2C enrollment observability certification passed.\n")
}

main()
