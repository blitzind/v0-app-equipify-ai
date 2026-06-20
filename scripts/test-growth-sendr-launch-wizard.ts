/**
 * GS-SENDR-3A — Launch wizard certification.
 * Run: pnpm test:growth-sendr-launch-wizard
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_SENDR_LAUNCH_QA_MARKER } from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3A Launch Wizard Certification ===\n")

  assert.equal(GROWTH_SENDR_LAUNCH_QA_MARKER, "growth-sendr-launch-gs-sendr-3a-v1")

  assert.ok(fs.existsSync("app/(growth)/growth/sendr/launch/page.tsx"))
  assert.ok(fs.existsSync("components/growth/sendr/growth-sendr-launch-wizard.tsx"))

  const wizard = readSource("components/growth/sendr/growth-sendr-launch-wizard.tsx")
  assert.match(wizard, /launch-preview/)
  assert.match(wizard, /launch-run/)
  assert.match(wizard, /action: "start"/)
  assert.match(wizard, /action: "continue"/)
  assert.match(wizard, /action: "cancel"/)
  assert.match(wizard, /runLaunchContinue/)
  assert.match(wizard, /runLaunchCancel/)
  assert.match(wizard, /nextAction === "continue"/)
  assert.match(wizard, /Continue/)
  assert.match(wizard, /Cancel launch/)
  assert.match(wizard, /Launch enrollment/)
  assert.doesNotMatch(wizard, /setInterval/)
  assert.doesNotMatch(wizard, /setTimeout.*runLaunchContinue/s)
  assert.doesNotMatch(wizard, /startImmediately:\s*true/)

  console.log("  ✓ Launch wizard manual continue/cancel (no polling)")
  console.log("\nGS-SENDR-3A launch wizard certification passed.\n")
}

main()
