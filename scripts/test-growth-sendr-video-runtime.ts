/**
 * GS-SENDR-2C — Public video runtime certification.
 * Run: pnpm test:growth-sendr-video-runtime
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2C Video Runtime Certification ===\n")
  const client = fs.readFileSync("components/sendr/sendr-public-page-client.tsx", "utf8")
  const presentation = fs.readFileSync(
    "components/growth/sendr/presentation/presentation-video-hero.tsx",
    "utf8",
  )
  assert.match(client, /page_view/)
  assert.match(client, /\/api\/public\/sendr\/events/)
  assert.match(presentation, /onVideoStart/)
  assert.match(presentation, /onVideoProgress/)
  assert.match(presentation, /onVideoComplete/)
  assert.match(presentation, /posterUrl/)
  const layout = fs.readFileSync(
    "components/growth/sendr/presentation/sendr-public-presentation-layout.tsx",
    "utf8",
  )
  assert.match(layout, /video_start/)
  assert.match(layout, /video_progress/)
  assert.match(layout, /video_complete/)
  assert.doesNotMatch(presentation, /transcode|upload/i)

  console.log("  ✓ Video metadata display and event tracking (no transcoding)")
  console.log("\nGS-SENDR-2C video runtime certification passed.\n")
}

main()
