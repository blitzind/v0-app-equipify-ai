/**
 * GS-SENDR-3A — Launch preview certification.
 * Run: pnpm test:growth-sendr-launch-preview
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_SENDR_LIMITS, GROWTH_SENDR_LAUNCH_QA_MARKER } from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3A Launch Preview Certification ===\n")

  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_PREVIEW_MEMBERS, 10_000)
  assert.equal(GROWTH_SENDR_LAUNCH_QA_MARKER, "growth-sendr-launch-gs-sendr-3a-v1")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/launch-preview/route.ts"))

  const preview = readSource("lib/growth/sendr/growth-sendr-launch-preview-service.ts")
  assert.match(preview, /computeSendrLaunchPreview/)
  assert.match(preview, /classifyAudienceMemberEnrollmentReadiness/)
  assert.match(preview, /estimatedWrites: 0/)
  assert.match(preview, /sendr_launch_previews/)

  const route = readSource("app/api/platform/growth/sendr/launch-preview/route.ts")
  assert.match(route, /POST/)

  console.log("  ✓ Read-only launch preview service + route")
  console.log("\nGS-SENDR-3A launch preview certification passed.\n")
}

main()
