/**
 * GS-GROWTH-MEDIA-LIBRARY-1A — Shared Growth media library certification.
 * Run: pnpm test:growth-media-library-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_MEDIA_ASSETS_BUCKET,
  GROWTH_MEDIA_ASSETS_MIGRATION,
} from "../lib/growth/media/media-asset-types"
import {
  buildGrowthMediaLibraryContentPath,
  buildGrowthMediaLibraryPublicUrl,
} from "../lib/growth/media-library/growth-media-library-url"
import {
  GROWTH_MEDIA_LIBRARY_MAX_BYTES,
  GROWTH_MEDIA_LIBRARY_MIME_TYPES,
  GROWTH_MEDIA_LIBRARY_QA_MARKER,
  GROWTH_MEDIA_LIBRARY_TAG,
} from "../lib/growth/media-library/growth-media-library-types"
import {
  validateGrowthMediaLibraryFile,
  validateGrowthMediaLibraryUpload,
} from "../lib/growth/media-library/growth-media-library-validation"

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function testAuditReuseDecision() {
  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_MEDIA_ASSETS_MIGRATION}`),
    "utf8",
  )
  assert.ok(migration.includes("growth.media_assets"))
  assert.equal(GROWTH_MEDIA_ASSETS_BUCKET, "growth-media-assets")
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/platform/growth/media-assets/route.ts")))
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/platform/growth/media-assets/upload-url/route.ts")))
  console.log("  ✓ Reuses growth.media_assets + growth-media-assets bucket (no duplicate table)")
}

function testValidation() {
  assert.equal(
    validateGrowthMediaLibraryUpload({ mimeType: "image/png", fileSizeBytes: 1024 }).ok,
    true,
  )
  assert.equal(
    validateGrowthMediaLibraryUpload({ mimeType: "image/svg+xml", fileSizeBytes: 1024 }).ok,
    false,
  )
  assert.equal(
    validateGrowthMediaLibraryUpload({
      mimeType: "image/jpeg",
      fileSizeBytes: GROWTH_MEDIA_LIBRARY_MAX_BYTES + 1,
    }).ok,
    false,
  )
  assert.equal(GROWTH_MEDIA_LIBRARY_MIME_TYPES.length, 3)
  console.log("  ✓ Upload validation enforces mime type and 5MB limit")
}

function testApiRoutesAndComponents() {
  const uploadRoute = readSource("app/api/platform/growth/media-assets/upload-url/route.ts")
  assert.match(uploadRoute, /requireMediaAssetPlatformAccess/)
  assert.match(uploadRoute, /invalid_mime_type/)
  assert.match(uploadRoute, /file_too_large/)

  const listRoute = readSource("app/api/platform/growth/media-assets/route.ts")
  assert.match(listRoute, /library/)
  assert.match(listRoute, /listGrowthMediaLibraryAssets/)

  const contentRoute = readSource("app/api/growth/media-library/[id]/content/route.ts")
  assert.match(contentRoute, /resolveGrowthMediaLibraryContentRedirect/)

  const picker = readSource("components/growth/media-library/growth-media-picker.tsx")
  assert.match(picker, /GrowthMediaPicker/)
  assert.match(picker, /Select from library/)
  assert.match(picker, /allowManualUrl/)
  assert.match(picker, /Paste manual URL/)

  const panel = readSource("components/growth/media-library/growth-media-library-panel.tsx")
  assert.match(panel, /GrowthMediaLibraryPanel/)
  assert.match(panel, /Copy URL/)
  assert.match(panel, /Archive/)

  console.log("  ✓ API routes and library UI components exist")
}

function testIntegrations() {
  const signatures = readSource("components/growth/signatures/growth-email-signatures-panel.tsx")
  assert.match(signatures, /GrowthMediaPicker/)
  assert.match(signatures, /logoUrl/)

  const booking = readSource("components/growth/growth-booking-pages-panel.tsx")
  assert.match(booking, /GrowthMediaPicker/)
  assert.match(booking, /heroImageUrl/)

  const shareBranding = readSource("components/growth/share-pages/growth-share-page-template-picker.tsx")
  assert.match(shareBranding, /GrowthMediaPicker/)
  assert.match(shareBranding, /heroImageUrl/)

  console.log("  ✓ Signatures, booking, and share page branding use media picker")
}

function testPublicUrlStrategy() {
  const assetId = "00000000-0000-4000-8000-000000000099"
  const path = buildGrowthMediaLibraryContentPath(assetId)
  assert.equal(path, `/api/growth/media-library/${assetId}/content`)
  assert.match(
    buildGrowthMediaLibraryPublicUrl(assetId, "https://app.equipify.ai"),
    /\/api\/growth\/media-library\/.*\/content$/,
  )
  console.log("  ✓ Stable public content URL strategy")
}

function testArchivedExcludedFromList() {
  const repository = readSource("lib/growth/media/media-asset-repository.ts")
  assert.match(repository, /excludeArchived/)
  const service = readSource("lib/growth/media-library/growth-media-library-service.ts")
  assert.match(service, /excludeArchived: !input.includeArchived/)
  console.log("  ✓ Archived assets excluded from default library list")
}

function testNoSendrReferences() {
  const files = [
    "lib/growth/media-library/growth-media-library-types.ts",
    "lib/growth/media-library/growth-media-library-service.ts",
    "components/growth/media-library/growth-media-picker.tsx",
    "components/growth/media-library/growth-media-library-panel.tsx",
    "app/api/platform/growth/media-assets/upload-url/route.ts",
    "app/api/growth/media-library/[id]/content/route.ts",
  ]
  for (const file of files) {
    const source = readSource(file)
    assert.ok(!/sendr/i.test(source), `SENDR reference in ${file}`)
  }
  console.log("  ✓ No SENDR references in media library module")
}

function testNavigation() {
  const nav = readSource("lib/settings/workspace-settings-navigation.ts")
  assert.match(nav, /media-library/)
  assert.match(nav, /Media Library/)
  const lift = readSource("lib/settings/workspace-settings-growth-engine-lift.ts")
  assert.match(lift, /"media-library"/)
  assert.match(lift, /GrowthMediaLibraryPanel/)
  console.log("  ✓ Workspace settings navigation includes media library")
}

function testLibraryTagConstant() {
  assert.equal(GROWTH_MEDIA_LIBRARY_TAG, "growth-media-library")
  assert.equal(GROWTH_MEDIA_LIBRARY_QA_MARKER, "growth-media-library-1a-v1")
  console.log("  ✓ Library QA marker and tag constants")
}

async function main() {
  console.log(`\n=== GS-GROWTH-MEDIA-LIBRARY-1A (${GROWTH_MEDIA_LIBRARY_QA_MARKER}) ===\n`)
  testAuditReuseDecision()
  testValidation()
  testApiRoutesAndComponents()
  testIntegrations()
  testPublicUrlStrategy()
  testArchivedExcludedFromList()
  testNoSendrReferences()
  testNavigation()
  testLibraryTagConstant()
  console.log("\nAll GS-GROWTH-MEDIA-LIBRARY-1A checks passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
