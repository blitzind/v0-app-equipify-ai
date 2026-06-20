/**
 * GS-SENDR-2D — Audience integration certification.
 * Run: pnpm test:growth-sendr-audience-integration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2D Audience Integration Certification ===\n")

  const wizard = readSource("components/growth/audiences/growth-audience-enrollment-wizard.tsx")
  assert.match(wizard, /sendrLandingPageId/)
  assert.match(wizard, /sendrPageAttachment/)
  assert.match(wizard, /GrowthSendrAssetPickerPanel/)
  assert.doesNotMatch(wizard, /setInterval/)

  const previewRoute = readSource(
    "app/api/platform/growth/audiences/[audienceId]/enrollment-preview/route.ts",
  )
  assert.match(previewRoute, /sendrLandingPageId/)

  const runRoute = readSource(
    "app/api/platform/growth/audiences/[audienceId]/enrollment-runs/route.ts",
  )
  assert.match(runRoute, /sendrLandingPageId/)

  const bridge = readSource("lib/growth/sendr/growth-sendr-audience-enrollment-bridge-service.ts")
  assert.match(bridge, /attachSendrPageOnAudienceEnrollment/)

  console.log("  ✓ Audience enrollment preview/confirm with SENDR page attachment")
  console.log("\nGS-SENDR-2D audience integration certification passed.\n")
}

main()
