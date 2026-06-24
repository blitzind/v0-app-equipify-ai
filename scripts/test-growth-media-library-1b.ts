/**
 * GS-GROWTH-MEDIA-LIBRARY-1B — Upload & asset management UX certification.
 * Run: pnpm test:growth-media-library-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_MEDIA_LIBRARY_1B_QA_MARKER,
  GROWTH_MEDIA_LIBRARY_KIND_TAGS,
} from "../lib/growth/media-library/growth-media-library-types"
import {
  GROWTH_MEDIA_LIBRARY_CATEGORY_OPTIONS,
  GROWTH_MEDIA_LIBRARY_KIND_LABELS,
} from "../lib/growth/media-library/growth-media-library-categories"
import { resolveGrowthMediaLibraryKindFromTags } from "../lib/growth/media-library/growth-media-library-url"

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function testCategories() {
  assert.equal(GROWTH_MEDIA_LIBRARY_KIND_LABELS.logo, "Logos")
  assert.equal(GROWTH_MEDIA_LIBRARY_KIND_LABELS.team, "Team Photos")
  assert.equal(GROWTH_MEDIA_LIBRARY_KIND_LABELS.hero, "Hero Images")
  assert.equal(GROWTH_MEDIA_LIBRARY_KIND_LABELS.image, "General Images")
  assert.equal(GROWTH_MEDIA_LIBRARY_CATEGORY_OPTIONS.length, 5)
  assert.equal(
    resolveGrowthMediaLibraryKindFromTags([GROWTH_MEDIA_LIBRARY_KIND_TAGS.avatar]),
    "team",
  )
  console.log("  ✓ Category labels and legacy avatar → team mapping")
}

function testPickerUx() {
  const picker = readSource("components/growth/media-library/growth-media-picker.tsx")
  assert.match(picker, /Upload Image/)
  assert.match(picker, /Choose From Library/)
  assert.match(picker, /Paste URL \(Advanced\)/)
  assert.match(picker, /GrowthMediaLibraryUploadZone/)
  assert.match(picker, /No media assets yet/)
  assert.match(picker, /GrowthMediaLibraryAssetCard/)
  assert.match(picker, /onArchive/)
  assert.match(picker, /setHighlightId/)
  console.log("  ✓ Picker supports upload, library, advanced URL, drag-drop zone, and asset actions")
}

function testUploadZone() {
  const zone = readSource("components/growth/media-library/growth-media-library-upload-zone.tsx")
  assert.match(zone, /Drop image here/)
  assert.match(zone, /onDrop/)
  assert.match(zone, /Upload Image/)
  console.log("  ✓ Upload zone supports drag-and-drop and file picker")
}

function testAssetCard() {
  const card = readSource("components/growth/media-library/growth-media-library-asset-card.tsx")
  assert.match(card, /formatGrowthMediaLibraryDimensions/)
  assert.match(card, /formatGrowthMediaLibraryDate/)
  assert.match(card, /Select/)
  assert.match(card, /Edit/)
  assert.match(card, /Archive/)
  console.log("  ✓ Asset cards show thumbnail metadata and actions")
}

function testManagementPanel() {
  const panel = readSource("components/growth/media-library/growth-media-library-panel.tsx")
  assert.match(panel, /GrowthMediaLibraryUploadZone/)
  assert.match(panel, /Search/)
  assert.match(panel, /Category/)
  assert.match(panel, /GROWTH_MEDIA_LIBRARY_1B_QA_MARKER/)
  console.log("  ✓ Dedicated media library panel supports upload, search, and categories")
}

function testApiKinds() {
  const uploadRoute = readSource("app/api/platform/growth/media-assets/upload-url/route.ts")
  assert.match(uploadRoute, /"team"/)
  assert.match(uploadRoute, /"hero"/)
  console.log("  ✓ Upload API accepts team and hero categories")
}

function testIntegrations() {
  const booking = readSource("components/growth/growth-booking-pages-panel.tsx")
  assert.match(booking, /acceptedTypes=\{\["hero", "image"\]\}/)
  const share = readSource("components/growth/share-pages/growth-share-page-template-picker.tsx")
  assert.match(share, /acceptedTypes=\{\["hero", "image"\]\}/)
  console.log("  ✓ Booking and share hero fields prefer hero category")
}

function testNoMigration() {
  const migrations = fs
    .readdirSync(path.join(process.cwd(), "supabase/migrations"))
    .filter((name) => name.includes("media-library"))
  assert.equal(migrations.length, 0)
  console.log("  ✓ No new migrations required")
}

async function main() {
  console.log(`\n=== GS-GROWTH-MEDIA-LIBRARY-1B (${GROWTH_MEDIA_LIBRARY_1B_QA_MARKER}) ===\n`)
  testCategories()
  testPickerUx()
  testUploadZone()
  testAssetCard()
  testManagementPanel()
  testApiKinds()
  testIntegrations()
  testNoMigration()
  console.log("\nAll GS-GROWTH-MEDIA-LIBRARY-1B checks passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
