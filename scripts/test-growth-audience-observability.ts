/**
 * GS-RG-2B — Audience observability certification (local static).
 * Run: pnpm test:growth-audience-observability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2B Audience Observability Certification ===\n")

  const observability = readSource("lib/growth/audiences/growth-audience-observability.ts")
  assert.match(observability, /snapshotsGeneratedToday/)
  assert.match(observability, /diffsGeneratedToday/)
  assert.match(observability, /membersAddedToday/)
  assert.match(observability, /leadCreationsToday/)
  assert.match(observability, /refreshBacklog/)

  const runtimeObs = readSource("lib/growth/runtime-guardrails/growth-runtime-observability-service.ts")
  assert.match(runtimeObs, /getGrowthAudienceObservabilitySnapshot/)
  assert.match(runtimeObs, /audiences/)

  const dashboard = readSource("components/growth/growth-runtime-observability-dashboard.tsx")
  assert.match(dashboard, /Audience metrics/)
  assert.match(dashboard, /diffsGeneratedToday/)
  assert.match(dashboard, /leadCreationsToday/)
  assert.doesNotMatch(dashboard, /setInterval/)

  const workspace = readSource("app/(growth)/growth/audiences/page.tsx")
  assert.match(workspace, /GrowthAudienceLibrary/)

  console.log("  ✓ Runtime dashboard extended — diff + lead creation metrics")
  console.log("\nGS-RG-2B audience observability certification passed.\n")
}

main()
