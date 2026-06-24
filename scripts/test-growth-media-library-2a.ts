/**
 * GS-GROWTH-MEDIA-LIBRARY-2A — Growth asset unification certification.
 * Run: pnpm test:growth-media-library-2a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_MEDIA_LIBRARY_2A_QA_MARKER,
  GROWTH_MEDIA_LIBRARY_KIND_TAGS,
  GROWTH_MEDIA_LIBRARY_TAG,
} from "../lib/growth/media-library/growth-media-library-types"
import {
  buildCanonicalGrowthMediaLibraryPublicUrl,
  GROWTH_MEDIA_LIBRARY_CANONICAL_ORIGIN_FALLBACK,
  isLocalhostGrowthMediaLibraryUrl,
  normalizeGrowthMediaLibraryPersistedUrl,
  resolveGrowthMediaLibraryPublicOrigin,
} from "../lib/growth/media-library/growth-media-library-canonical-url"
import {
  buildGrowthMediaLibraryContentPath,
  extractGrowthMediaLibraryAssetIdFromUrl,
} from "../lib/growth/media-library/growth-media-library-url"

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function testCanonicalUrlGeneration() {
  const assetId = "11111111-1111-4111-8111-111111111111"
  const canonical = buildCanonicalGrowthMediaLibraryPublicUrl(assetId)
  assert.match(canonical, /^https:\/\/app\.equipify\.ai\/api\/growth\/media-library\//)
  assert.match(canonical, new RegExp(`${buildGrowthMediaLibraryContentPath(assetId).replace(/\//g, "\\/")}$`))

  const fromLocalhost = normalizeGrowthMediaLibraryPersistedUrl(
    `http://localhost:3000/api/growth/media-library/${assetId}/content`,
    { assetId },
  )
  assert.equal(fromLocalhost, canonical)
  assert.equal(isLocalhostGrowthMediaLibraryUrl(`http://localhost:3000/api/growth/media-library/${assetId}/content`), true)
  assert.equal(isLocalhostGrowthMediaLibraryUrl("https://cdn.example.com/logo.png"), false)

  const external = normalizeGrowthMediaLibraryPersistedUrl("https://cdn.example.com/logo.png")
  assert.equal(external, "https://cdn.example.com/logo.png")

  assert.equal(
    resolveGrowthMediaLibraryPublicOrigin("http://localhost:3000"),
    GROWTH_MEDIA_LIBRARY_CANONICAL_ORIGIN_FALLBACK,
  )
  console.log("  ✓ Canonical URL generation avoids localhost for library assets")
}

function testExistingUrlsStillResolve() {
  const assetId = "22222222-2222-4222-8222-222222222222"
  const legacySigned =
    "https://example.supabase.co/storage/v1/object/sign/growth-media-assets/org/file.png?token=abc"
  assert.equal(extractGrowthMediaLibraryAssetIdFromUrl(legacySigned), null)
  assert.equal(normalizeGrowthMediaLibraryPersistedUrl(legacySigned), legacySigned)

  const libraryPath = `/api/growth/media-library/${assetId}/content`
  assert.equal(extractGrowthMediaLibraryAssetIdFromUrl(libraryPath), assetId)
  assert.equal(
    extractGrowthMediaLibraryAssetIdFromUrl(`https://app.equipify.ai${libraryPath}`),
    assetId,
  )
  console.log("  ✓ Existing external URLs pass through; library paths still resolve asset IDs")
}

function testTeamCategoryFiltering() {
  assert.equal(GROWTH_MEDIA_LIBRARY_KIND_TAGS.team, "library-kind:team")
  const picker = readSource("components/growth/media-library/growth-media-picker.tsx")
  assert.match(picker, /matchesAcceptedTypes/)
  assert.match(picker, /acceptedTypes\.includes\(asset\.libraryKind\)/)
  console.log("  ✓ Team category tag and picker filtering remain in place")
}

function testAvatarPickerIntegrations() {
  const signatures = readSource("components/growth/signatures/growth-email-signatures-panel.tsx")
  assert.match(signatures, /acceptedTypes=\{\["team"\]\}/)
  assert.match(signatures, /Team photo/)

  const profile = readSource("components/growth/settings/growth-settings-profile-panel.tsx")
  assert.match(profile, /GrowthMediaPicker/)
  assert.match(profile, /acceptedTypes=\{\["team"\]\}/)
  assert.doesNotMatch(profile, /Avatar URL/)
  console.log("  ✓ Team headshot picker wired for sender profiles and operator profile")
}

function testVideoBrandingPickers() {
  const create = readSource("components/growth/videos/growth-video-page-create-panel.tsx")
  assert.match(create, /GrowthMediaPicker/)
  assert.match(create, /acceptedTypes=\{\["logo", "image"\]\}/)
  assert.doesNotMatch(create, /Logo URL/)

  const branding = readSource("components/growth/videos/growth-video-branding-settings-panel.tsx")
  assert.match(branding, /GrowthMediaPicker/)
  assert.doesNotMatch(branding, /Logo URL/)

  const thumbnail = readSource("components/growth/videos/growth-video-page-thumbnail-section.tsx")
  assert.match(thumbnail, /GrowthMediaPicker/)
  assert.match(thumbnail, /Company logo/)
  assert.doesNotMatch(thumbnail, /Company Logo URL/)
  console.log("  ✓ Video branding surfaces use media picker for logos")
}

function testShareSectionHeroPicker() {
  const sectionEditor = readSource(
    "components/growth/share-pages/templates/growth-share-page-template-section-editor.tsx",
  )
  assert.match(sectionEditor, /acceptedTypes=\{\["hero", "image"\]\}/)
  assert.match(sectionEditor, /heroMediaType: url \? "image" : "none"/)
  assert.doesNotMatch(sectionEditor, /Hero image URL/)

  const settings = readSource(
    "components/growth/share-pages/templates/growth-share-page-template-settings-panel.tsx",
  )
  assert.match(settings, /Preview image/)
  assert.doesNotMatch(settings, /Preview image URL/)
  console.log("  ✓ Share template section editor and preview image use media picker")
}

function testPickerPersistsCanonicalUrls() {
  const picker = readSource("components/growth/media-library/growth-media-picker.tsx")
  assert.match(picker, /normalizeGrowthMediaLibraryPersistedUrl/)

  const upload = readSource("lib/growth/media-library/growth-media-library-upload.ts")
  assert.match(upload, /normalizeGrowthMediaLibraryPersistedUrl/)

  const urlModule = readSource("lib/growth/media-library/growth-media-library-url.ts")
  assert.match(urlModule, /buildCanonicalGrowthMediaLibraryPublicUrl/)
  console.log("  ✓ Picker and upload client normalize library URLs to canonical origin")
}

function testArchiveBehaviorUnchanged() {
  const picker = readSource("components/growth/media-library/growth-media-picker.tsx")
  assert.match(picker, /archiveGrowthMediaLibraryAsset/)
  assert.match(picker, /onArchive/)

  const uploadClient = readSource("lib/growth/media-library/growth-media-library-upload.ts")
  assert.match(uploadClient, /method: "DELETE"/)
  console.log("  ✓ Asset archive behavior unchanged")
}

function testNoDuplicateAssetSystems() {
  const migrations = fs
    .readdirSync(path.join(process.cwd(), "supabase/migrations"))
    .filter((name) => name.includes("media-library"))
  assert.equal(migrations.length, 0)

  const service = readSource("lib/growth/media-library/growth-media-library-service.ts")
  assert.match(service, /growth\.media_assets|from\("media_assets"\)/)
  assert.match(service, new RegExp(GROWTH_MEDIA_LIBRARY_TAG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  console.log("  ✓ No duplicate asset table or migrations introduced")
}

async function main() {
  console.log(`\n=== GS-GROWTH-MEDIA-LIBRARY-2A (${GROWTH_MEDIA_LIBRARY_2A_QA_MARKER}) ===\n`)
  testCanonicalUrlGeneration()
  testExistingUrlsStillResolve()
  testTeamCategoryFiltering()
  testAvatarPickerIntegrations()
  testVideoBrandingPickers()
  testShareSectionHeroPicker()
  testPickerPersistsCanonicalUrls()
  testArchiveBehaviorUnchanged()
  testNoDuplicateAssetSystems()
  console.log("\nAll GS-GROWTH-MEDIA-LIBRARY-2A checks passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
