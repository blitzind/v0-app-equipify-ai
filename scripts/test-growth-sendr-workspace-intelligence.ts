/**
 * GS-SENDR-2E — Workspace intelligence certification.
 * Run: pnpm test:growth-sendr-workspace-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2E Workspace Intelligence Certification ===\n")

  const service = readSource("lib/growth/sendr/growth-sendr-workspace-intelligence-service.ts")
  assert.match(service, /getGrowthSendrWorkspaceIntelligence/)
  assert.match(service, /topPerformingPages/)
  assert.match(service, /highIntentProspects/)
  assert.match(service, /pagesNeedingAttention/)

  const home = readSource("components/growth/sendr/growth-sendr-workspace-home.tsx")
  assert.match(home, /Top performing pages/)
  assert.match(home, /High intent prospects/)
  assert.match(home, /Pages needing attention/)
  assert.doesNotMatch(home, /setInterval/)

  const workspace = readSource("lib/growth/sendr/growth-sendr-workspace-service.ts")
  assert.match(workspace, /getGrowthSendrWorkspaceIntelligence/)

  console.log("  ✓ Manual-refresh workspace intelligence widgets")
  console.log("\nGS-SENDR-2E workspace intelligence certification passed.\n")
}

main()
