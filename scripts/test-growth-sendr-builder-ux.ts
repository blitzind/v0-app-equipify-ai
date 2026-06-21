/**
 * GS-SENDR-6C — Builder & operator UX certification.
 * Run: pnpm test:growth-sendr-builder-ux
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_SENDR_BUILDER_UX_QA_MARKER } from "../lib/growth/sendr/growth-sendr-builder-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-6C Builder UX Certification ===\n")

  assert.equal(GROWTH_SENDR_BUILDER_UX_QA_MARKER, "growth-sendr-builder-ux-gs-sendr-6c-v1")

  const builderComponents = [
    "components/growth/sendr/builder/growth-sendr-builder-header.tsx",
    "components/growth/sendr/builder/growth-sendr-builder-live-preview.tsx",
    "components/growth/sendr/builder/growth-sendr-builder-section-card.tsx",
    "components/growth/sendr/builder/growth-sendr-builder-empty-state.tsx",
    "components/growth/sendr/builder/growth-sendr-builder-readiness-panel.tsx",
    "components/growth/sendr/builder/growth-sendr-builder-publish-panel.tsx",
    "lib/growth/sendr/growth-sendr-builder-config.ts",
    "lib/growth/sendr/growth-sendr-builder-section-meta.ts",
    "lib/growth/sendr/growth-sendr-page-preview-payload.ts",
  ]
  for (const file of builderComponents) {
    assert.ok(fs.existsSync(file), `missing ${file}`)
  }

  const detail = readSource("components/growth/sendr/growth-sendr-page-detail.tsx")
  for (const tab of ["overview", "sections", "personalization", "media", "booking", "publish"]) {
    assert.match(detail, new RegExp(tab, "i"))
  }
  assert.match(detail, /GrowthSendrBuilderLivePreview/)
  assert.match(detail, /GrowthSendrBuilderSectionCard/)
  assert.match(detail, /GrowthSendrBuilderPublishPanel/)
  assert.match(detail, /include=detail/)
  assert.doesNotMatch(detail, /setInterval|poll/i)

  const preview = readSource("components/growth/sendr/builder/growth-sendr-builder-live-preview.tsx")
  assert.match(preview, /View as prospect/)
  assert.match(preview, /SendrPublicPresentationLayout/)
  assert.match(preview, /desktop.*tablet.*mobile|DEVICE_OPTIONS/is)
  assert.match(preview, /GROWTH_SENDR_BUILDER_UX_QA_MARKER/)
  assert.doesNotMatch(preview, /iframe/i)

  const publish = readSource("components/growth/sendr/builder/growth-sendr-builder-publish-panel.tsx")
  assert.match(publish, /Ready to send/)
  assert.match(publish, /Publication history/)

  console.log("  ✓ Builder shell, sticky preview, section cards, and publish UX preserved")
  console.log("\nGS-SENDR-6C builder UX certification passed.\n")
}

main()
