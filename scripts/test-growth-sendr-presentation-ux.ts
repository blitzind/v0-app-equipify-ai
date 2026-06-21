/**
 * GS-SENDR-6A/6B — Presentation UX certification.
 * Run: pnpm test:growth-sendr-presentation-ux
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_PRESENTATION_POLISH_QA_MARKER,
  GROWTH_SENDR_PRESENTATION_UX_QA_MARKER,
} from "../lib/growth/sendr/growth-sendr-presentation-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-6A/6B Presentation UX Certification ===\n")

  assert.equal(GROWTH_SENDR_PRESENTATION_UX_QA_MARKER, "growth-sendr-presentation-ux-gs-sendr-6a-v1")
  assert.equal(GROWTH_SENDR_PRESENTATION_POLISH_QA_MARKER, "growth-sendr-presentation-polish-gs-sendr-6b-v1")

  const primitives = [
    "components/growth/sendr/presentation/presentation-page-shell.tsx",
    "components/growth/sendr/presentation/presentation-card.tsx",
    "components/growth/sendr/presentation/presentation-section.tsx",
    "components/growth/sendr/presentation/presentation-video-hero.tsx",
    "components/growth/sendr/presentation/presentation-video-empty-state.tsx",
    "components/growth/sendr/presentation/presentation-sidebar-brand.tsx",
    "components/growth/sendr/presentation/presentation-cta-button.tsx",
    "components/growth/sendr/presentation/presentation-deck-rhythm.tsx",
    "components/growth/sendr/presentation/presentation-testimonial-card.tsx",
    "components/growth/sendr/presentation/presentation-resource-card.tsx",
    "components/growth/sendr/presentation/sendr-public-presentation-layout.tsx",
    "components/growth/sendr/growth-sendr-page-preview-panel.tsx",
    "lib/growth/sendr/growth-sendr-presentation-content.ts",
  ]
  for (const file of primitives) {
    assert.ok(fs.existsSync(file), `missing ${file}`)
  }

  const client = readSource("components/sendr/sendr-public-page-client.tsx")
  assert.match(client, /PresentationPageShell/)
  assert.match(client, /SendrPublicPresentationLayout/)
  assert.match(client, /getVisitorAttributionFromUrl/)
  assert.match(client, /page_view/)
  assert.doesNotMatch(client, /setInterval/)

  const shell = readSource("components/growth/sendr/presentation/presentation-page-shell.tsx")
  assert.match(shell, /rounded-\[28px\]/)
  assert.match(shell, /GROWTH_SENDR_PRESENTATION_UX_QA_MARKER/)

  const layout = readSource("components/growth/sendr/presentation/sendr-public-presentation-layout.tsx")
  assert.match(layout, /lg:grid-cols-\[38%_62%\]/)
  assert.match(layout, /PresentationVideoHero/)
  assert.match(layout, /PresentationVideoEmptyState/)
  assert.match(layout, /PresentationSidebarBrand/)
  assert.match(layout, /PresentationFinaleCta/)
  assert.match(layout, /PresentationTestimonialCard/)
  assert.match(layout, /PresentationResourceCard/)
  assert.doesNotMatch(layout, /Published v|Created at/)

  const emptyState = readSource("components/growth/sendr/presentation/presentation-video-empty-state.tsx")
  assert.match(emptyState, /Your personalized video will appear here/)

  const sidebar = readSource("components/growth/sendr/presentation/presentation-sidebar-brand.tsx")
  assert.match(sidebar, /GROWTH_SENDR_PRESENTATION_FEATURE_BADGES/)
  assert.match(sidebar, /Trusted by service businesses nationwide/)

  const cta = readSource("components/growth/sendr/presentation/presentation-cta-button.tsx")
  assert.match(cta, /min-h-\[3\.25rem\]/)
  assert.match(cta, /fullWidth/)

  const pageDetail = readSource("components/growth/sendr/growth-sendr-page-detail.tsx")
  assert.match(pageDetail, /GrowthSendrBuilderLivePreview/)

  const publicView = readSource("lib/growth/sendr/growth-sendr-public-page-view.tsx")
  assert.match(publicView, /SendrPublicPageClient/)
  assert.doesNotMatch(publicView, /setInterval|poll/i)

  console.log("  ✓ Presentation shell, polish layer, deck rhythm, and runtime tracking preserved")
  console.log("\nGS-SENDR-6A/6B presentation UX certification passed.\n")
}

main()
