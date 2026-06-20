/**
 * GS-SENDR-2B — Audience bridge certification.
 * Run: pnpm test:growth-sendr-audience-bridge
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2B Audience Bridge Certification ===\n")

  const detail = fs.readFileSync("components/growth/audiences/growth-audience-detail.tsx", "utf8")
  assert.match(detail, /Create SENDR Page/)
  assert.match(detail, /\/growth\/sendr\/new/)
  assert.match(detail, /audienceMemberId/)
  assert.match(detail, /sendrBridgeMember/)
  assert.doesNotMatch(detail, /bulk.*sendr/i)

  console.log("  ✓ Single-member audience → SENDR page bridge")
  console.log("\nGS-SENDR-2B audience bridge certification passed.\n")
}

main()
