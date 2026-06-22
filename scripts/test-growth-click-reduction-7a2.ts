/**
 * GS-GROWTH-OPS-7A.2 — Click reduction bundle certification.
 * Run: pnpm test:growth-click-reduction-7a2
 */
import { spawnSync } from "node:child_process"

const CERTS = [
  "test:growth-crm-primary-action-7a2",
  "test:growth-call-shortcuts-7a2",
  "test:growth-inbox-action-cleanup-7a2",
  "test:growth-opportunity-primary-action-7a2",
  "test:growth-send-handoff-7a2",
] as const

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.2 Click Reduction Bundle Certification ===\n")

  for (const script of CERTS) {
    console.log(`→ ${script}`)
    const result = spawnSync("pnpm", [script], { stdio: "inherit", shell: true })
    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }
  }

  const rail = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "components/growth/activity/growth-activity-high-intent-rail.tsx"),
    "utf8",
  )
  if (!/HotProspectHeroCard/.test(rail) || !/buildGrowthActivityHotProspectHeroActions/.test(rail)) {
    console.error("Activity hot-prospect hero card missing primary/secondary action layout.")
    process.exit(1)
  }
  console.log("  ✓ activity hot-prospect hero exposes Open Lead primary with secondary shortcuts")

  console.log("\nGS-GROWTH-OPS-7A.2 click reduction bundle certification passed.\n")
}

main()
