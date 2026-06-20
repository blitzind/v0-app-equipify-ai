/**
 * GS-SENDR-2D — Workspace metrics certification.
 * Run: pnpm test:growth-sendr-workspace-metrics
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2D Workspace Metrics Certification ===\n")

  const metrics = readSource("lib/growth/sendr/growth-sendr-workspace-metrics-service.ts")
  assert.match(metrics, /getGrowthSendrWorkspaceMetrics/)
  assert.match(metrics, /publishedPagesTotal/)
  assert.match(metrics, /attachedToSequencesCount/)
  assert.match(metrics, /topPages/)

  const home = readSource("components/growth/sendr/growth-sendr-workspace-home.tsx")
  assert.match(home, /Published pages/)
  assert.match(home, /Attached to sequences/)
  assert.match(home, /Top pages/)
  assert.doesNotMatch(home, /setInterval/)

  const workspace = readSource("lib/growth/sendr/growth-sendr-workspace-service.ts")
  assert.match(workspace, /getGrowthSendrWorkspaceMetrics/)

  console.log("  ✓ Manual-refresh workspace metrics widgets")
  console.log("\nGS-SENDR-2D workspace metrics certification passed.\n")
}

main()
