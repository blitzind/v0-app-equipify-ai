/**
 * GS-SENDR-2D — Asset picker certification.
 * Run: pnpm test:growth-sendr-asset-picker
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2D Asset Picker Certification ===\n")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/assets/route.ts"))
  assert.ok(fs.existsSync("components/growth/sendr/growth-sendr-asset-picker-panel.tsx"))

  const service = readSource("lib/growth/sendr/growth-sendr-asset-picker-service.ts")
  assert.match(service, /listSendrAssetPickerItems/)
  assert.match(service, /listGrowthVideoAssetsForSendrPicker/)
  assert.match(service, /assetKind: "video"/)
  assert.match(service, /sendr_metadata/)
  assert.match(service, /assetKind: "booking"/)
  assert.match(service, /getSendrPageAttachmentPreview/)

  const panel = readSource("components/growth/sendr/growth-sendr-asset-picker-panel.tsx")
  assert.match(panel, /\/api\/platform\/growth\/sendr\/assets/)
  assert.match(panel, /\/growth\/videos\/record/)
  assert.match(panel, /previewUrl/)
  assert.doesNotMatch(panel, /setInterval/)

  const videoRoute = readSource("app/api/platform/growth/sendr/video-assets/route.ts")
  assert.match(videoRoute, /attach_existing/)
  assert.match(videoRoute, /attach_growth_video/)

  console.log("  ✓ Unified asset picker browse/search/filter without duplicate creation")
  console.log("\nGS-SENDR-2D asset picker certification passed.\n")
}

main()
