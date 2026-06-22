/**
 * GS-SENDR-2B — SENDR workspace entry certification.
 * Run: pnpm test:growth-sendr-workspace
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_WORKSPACE_QA_MARKER,
} from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2B SENDR Workspace Certification ===\n")
  assert.equal(GROWTH_SENDR_WORKSPACE_QA_MARKER, "growth-sendr-operator-workspace-gs-sendr-2b-v1")

  assert.ok(fs.existsSync("app/(growth)/growth/videos/personalized/page.tsx"))
  assert.ok(fs.existsSync("app/(growth)/growth/sendr/page.tsx"))
  assert.ok(fs.existsSync("app/api/platform/growth/sendr/workspace/route.ts"))

  const home = readSource("components/growth/sendr/growth-sendr-workspace-home.tsx")
  assert.match(home, /\/api\/platform\/growth\/sendr\/workspace/)
  assert.match(home, /Create Video Page/)
  assert.doesNotMatch(home, /setInterval/)

  const service = readSource("lib/growth/sendr/growth-sendr-workspace-service.ts")
  assert.match(service, /getGrowthSendrWorkspaceSummary/)
  assert.match(service, /buildSendrPagePublicLink/)

  console.log("  ✓ SENDR workspace route and launch center")
  console.log("\nGS-SENDR-2B workspace certification passed.\n")
}

main()
