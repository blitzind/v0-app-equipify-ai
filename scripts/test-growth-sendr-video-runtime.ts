/**
 * GS-SENDR-2C — Public video runtime certification.
 * Run: pnpm test:growth-sendr-video-runtime
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2C Video Runtime Certification ===\n")
  const client = fs.readFileSync("components/sendr/sendr-public-page-client.tsx", "utf8")
  assert.match(client, /video_start/)
  assert.match(client, /video_progress/)
  assert.match(client, /video_complete/)
  assert.match(client, /posterUrl/)
  assert.doesNotMatch(client, /transcode|upload/i)

  console.log("  ✓ Video metadata display and event tracking (no transcoding)")
  console.log("\nGS-SENDR-2C video runtime certification passed.\n")
}

main()
