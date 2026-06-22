/**
 * GS-GROWTH-OPS-6C — Operator handoff bundle certification.
 * Run: pnpm test:growth-ops-handoff-6c
 */
import { spawnSync } from "node:child_process"

const CERTS = [
  "test:growth-inbox-handoff-6c",
  "test:growth-meetings-handoff-6c",
  "test:growth-opportunity-nba-display-6c",
  "test:growth-notification-link-normalization-6c",
  "test:growth-ops-navigation-6b",
  "test:growth-workspace-link-normalization",
  "test:growth-activity-center-5b",
] as const

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-6C Operator Handoff Bundle Certification ===\n")

  for (const script of CERTS) {
    console.log(`→ ${script}`)
    const result = spawnSync("pnpm", [script], { stdio: "inherit", shell: true })
    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }
  }

  console.log("\n→ check:tracked-imports")
  const imports = spawnSync("pnpm", ["check:tracked-imports"], { stdio: "inherit", shell: true })
  if (imports.status !== 0) {
    process.exit(imports.status ?? 1)
  }

  const sequenceDashboard = require("node:fs").readFileSync(
    require("node:path").join(process.cwd(), "components/growth/growth-sequence-safe-execution-dashboard.tsx"),
    "utf8",
  )
  if (!/Admin approval queue/.test(sequenceDashboard) || !/Control-plane review/.test(sequenceDashboard)) {
    console.error("Sequence execution dashboard missing control-plane labeling.")
    process.exit(1)
  }
  console.log("  ✓ sequence send approval labeled as control-plane/admin")

  console.log("\nGS-GROWTH-OPS-6C operator handoff bundle certification passed.\n")
}

main()
