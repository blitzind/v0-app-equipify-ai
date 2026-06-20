/**
 * GS-SENDR-2B — Media attachment certification.
 * Run: pnpm test:growth-sendr-media-attachment
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2B Media Attachment Certification ===\n")
  assert.ok(fs.existsSync("app/api/platform/growth/sendr/video-assets/route.ts"))

  const route = fs.readFileSync("app/api/platform/growth/sendr/video-assets/route.ts", "utf8")
  assert.match(route, /registerGrowthSendrVideoAssetMetadata/)
  assert.match(route, /posterUrl/)
  assert.match(route, /transcriptStatus/)
  assert.match(route, /action === "attach"/)
  assert.doesNotMatch(route, /transcode|upload/i)

  const repo = fs.readFileSync("lib/growth/sendr/growth-sendr-video-runtime-repository.ts", "utf8")
  assert.match(repo, /updateGrowthSendrVideoAssetMetadata/)

  console.log("  ✓ Video metadata register and attach (metadata only)")
  console.log("\nGS-SENDR-2B media attachment certification passed.\n")
}

main()
