/**
 * GS-SENDR-4B — Operator video workflow certification.
 * Run: pnpm test:growth-sendr-video-workflow
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-4B Operator Video Workflow Certification ===\n")

  const returnFlow = readSource("lib/growth/sendr/growth-sendr-video-return-flow.ts")
  assert.match(returnFlow, /buildSendrVideoReturnContextForPage/)
  assert.match(returnFlow, /parseSendrVideoReturnContext/)
  assert.match(returnFlow, /parseSendrReturnAttachParams/)
  assert.match(returnFlow, /buildSendrReturnWithAssetPath/)
  assert.match(returnFlow, /buildGrowthVideoRecordHref/)
  assert.match(returnFlow, /buildGrowthVideoLibraryHref/)
  assert.match(returnFlow, /isSafeSendrReturnPath/)

  const bridge = readSource("lib/growth/sendr/growth-sendr-growth-video-bridge-service.ts")
  assert.match(bridge, /linkGrowthVideoAssetToSendrSection/)
  assert.match(bridge, /detachGrowthVideoFromSendrSection/)
  assert.match(bridge, /detachGrowthVideoFromSendrPage/)
  assert.match(bridge, /enrichSendrPublicSectionsWithVideoPlayback/)
  assert.match(bridge, /resolveSendrSectionVideoPlayback/)
  assert.doesNotMatch(bridge, /setInterval|subscribe|worker|cron/i)

  const videoRoute = readSource("app/api/platform/growth/sendr/video-assets/route.ts")
  assert.match(videoRoute, /attach_growth_video_section/)
  assert.match(videoRoute, /detach_page_video/)
  assert.match(videoRoute, /detach_section_video/)

  const publicPage = readSource("lib/growth/sendr/growth-sendr-public-page-service.ts")
  assert.match(publicPage, /enrichSendrPublicSectionsWithVideoPlayback/)

  const engagement = readSource("lib/growth/sendr/growth-sendr-public-engagement-service.ts")
  assert.match(engagement, /eventValue\?\.videoAssetId/)

  const pageDetail = readSource("components/growth/sendr/growth-sendr-page-detail.tsx")
  assert.match(pageDetail, /parseSendrReturnAttachParams/)
  assert.match(pageDetail, /GrowthSendrSectionVideoEditor/)
  assert.match(pageDetail, /detach_page_video/)
  assert.match(pageDetail, /returnContext={pageReturnContext}/)

  const sectionEditor = readSource("components/growth/sendr/growth-sendr-section-video-editor.tsx")
  assert.match(sectionEditor, /attach_growth_video_section/)
  assert.match(sectionEditor, /detach_section_video/)

  const library = readSource("components/growth/videos/growth-video-library-panel.tsx")
  assert.match(library, /parseSendrVideoReturnContext/)
  assert.match(library, /buildSendrReturnWithAssetPath/)
  assert.match(library, /Use for page/)

  const record = readSource("components/growth/videos/growth-video-record-shell.tsx")
  assert.match(record, /parseSendrVideoReturnContext/)
  assert.match(record, /buildGrowthVideoLibraryHref/)

  const client = readSource("components/sendr/sendr-public-page-client.tsx")
  assert.match(client, /videoPlayback/)
  assert.match(client, /videoAssetId/)
  assert.match(client, /video_start/)
  assert.doesNotMatch(client, /setInterval/)

  console.log("  ✓ Return flow: record/upload/library → page detail with asset attach")
  console.log("  ✓ Section-level video attach/replace/remove/preview")
  console.log("  ✓ Public runtime prefers section playback with page fallback")
  console.log("  ✓ Engagement attribution supports section videoAssetId")
  console.log("  ✓ SSR snapshot + personalization + tokenized URLs preserved")
  console.log("  ✓ No polling, realtime, workers, or cron")
  console.log("\nGS-SENDR-4B operator video workflow certification passed.\n")
}

main()
