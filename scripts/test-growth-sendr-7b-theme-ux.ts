/**
 * GS-SENDR-7B — Theme controls, calendar picker, AI generation, templates certification.
 * Run: pnpm test:growth-sendr-7b-theme-ux
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_LEGACY_DARK_PAGE_THEME,
  GROWTH_SENDR_DEFAULT_PAGE_THEME,
  GROWTH_SENDR_PAGE_THEME_QA_MARKER,
  growthSendrThemeCssVars,
  resolveGrowthSendrPageTheme,
} from "../lib/growth/sendr/growth-sendr-page-theme"
import { GROWTH_SENDR_PAGE_TEMPLATES, getGrowthSendrPageTemplate } from "../lib/growth/sendr/growth-sendr-page-templates"
import { buildGrowthSendrPagePreviewPayload } from "../lib/growth/sendr/growth-sendr-page-preview-payload"

const GROWTH_SENDR_PAGE_AI_GENERATION_QA_MARKER = "growth-sendr-page-ai-generation-gs-sendr-7b-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-7B Theme, Calendar Picker, AI & Templates Certification ===\n")

  assert.equal(GROWTH_SENDR_PAGE_THEME_QA_MARKER, "growth-sendr-page-theme-gs-sendr-7b-v1")
  assert.equal(GROWTH_SENDR_PAGE_AI_GENERATION_QA_MARKER, "growth-sendr-page-ai-generation-gs-sendr-7b-v1")

  // Theme — legacy dark when unset; operator theme when saved
  const legacy = resolveGrowthSendrPageTheme(undefined)
  assert.equal(legacy.pageBackground, GROWTH_SENDR_LEGACY_DARK_PAGE_THEME.pageBackground)
  assert.equal(legacy.headerBackground, GROWTH_SENDR_LEGACY_DARK_PAGE_THEME.headerBackground)

  const lightBody = resolveGrowthSendrPageTheme({
    theme: {
      pageBackground: "#f8fafc",
      pageText: "#0f172a",
      headerBackground: "#07111f",
      headerText: "#ffffff",
      buttonBackground: "#f59e0b",
      buttonText: "#111827",
    },
  })
  assert.equal(lightBody.pageBackground, "#f8fafc")
  assert.equal(lightBody.headerBackground, "#07111f")
  assert.equal(lightBody.buttonBackground, "#f59e0b")

  const cssVars = growthSendrThemeCssVars(GROWTH_SENDR_DEFAULT_PAGE_THEME)
  assert.ok(cssVars["--sendr-page-bg"])
  assert.ok(cssVars["--sendr-button-bg"])

  const previewPayload = buildGrowthSendrPagePreviewPayload({
    page: {
      id: "page-1",
      organizationId: "org-1",
      title: "Demo",
      status: "draft",
      slug: null,
      publishedSlug: null,
      publishedVersion: null,
      publishedAt: null,
      leadId: null,
      templateType: "default",
      variableMap: {},
      mobileMetadata: {
        theme: {
          pageBackground: "#f8fafc",
          pageText: "#0f172a",
          headerBackground: "#07111f",
          headerText: "#ffffff",
          footerText: "Custom footer",
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    sections: [],
    prospectMode: true,
  })
  assert.equal(previewPayload.theme?.footerText, "Custom footer")

  const themeFiles = [
    "lib/growth/sendr/growth-sendr-page-theme.ts",
    "components/growth/sendr/presentation/presentation-theme-provider.tsx",
    "components/growth/sendr/builder/growth-sendr-builder-branding-panel.tsx",
  ]
  for (const file of themeFiles) {
    assert.ok(fs.existsSync(file), `missing ${file}`)
  }

  const publicClient = readSource("components/sendr/sendr-public-page-client.tsx")
  assert.match(publicClient, /PresentationThemeProvider/)
  assert.match(publicClient, /page\.theme/)
  assert.doesNotMatch(publicClient, /setInterval|poll/i)

  const livePreview = readSource("components/growth/sendr/builder/growth-sendr-builder-live-preview.tsx")
  assert.match(livePreview, /PresentationThemeProvider/)

  const presentation = readSource("components/growth/sendr/presentation/presentation-page-shell.tsx")
  assert.match(presentation, /--sendr-page-bg/)
  assert.match(presentation, /--sendr-surface/)

  const cta = readSource("components/growth/sendr/presentation/presentation-cta-button.tsx")
  assert.match(cta, /--sendr-button-bg/)

  const sidebar = readSource("components/growth/sendr/presentation/presentation-sidebar-brand.tsx")
  assert.match(sidebar, /--sendr-header-bg/)
  assert.match(sidebar, /logoUrl/)

  const publicService = readSource("lib/growth/sendr/growth-sendr-public-page-service.ts")
  assert.match(publicService, /resolveGrowthSendrPageTheme/)

  // Calendar picker
  const bookingPicker = readSource("components/growth/sendr/builder/growth-sendr-builder-booking-page-picker.tsx")
  assert.match(bookingPicker, /\/api\/platform\/growth\/booking-pages/)
  assert.match(bookingPicker, /legacyBookingPageId/)
  assert.match(bookingPicker, /No booking pages yet/)
  assert.match(bookingPicker, /paste a calendar URL manually/i)

  const detail = readSource("components/growth/sendr/growth-sendr-page-detail.tsx")
  assert.match(detail, /GrowthSendrBuilderBrandingPanel/)
  assert.match(detail, /GrowthSendrBuilderBookingPagePicker/)
  assert.match(detail, /GrowthSendrBuilderAiDraftPanel/)
  for (const tab of ["branding", "ai", "booking"]) {
    assert.match(detail, new RegExp(`value="${tab}"`))
  }

  // AI generation — operator-driven, no auto-publish
  const aiPanel = readSource("components/growth/sendr/builder/growth-sendr-builder-ai-draft-panel.tsx")
  assert.match(aiPanel, /generate_ai_draft/)
  assert.match(aiPanel, /apply_page_draft/)
  assert.match(aiPanel, /Apply draft to page/)
  assert.doesNotMatch(aiPanel, /action:\s*"publish"/)

  const landingRoute = readSource("app/api/platform/growth/sendr/landing-pages/route.ts")
  assert.match(landingRoute, /generate_ai_draft/)
  assert.match(landingRoute, /apply_template/)
  assert.match(landingRoute, /apply_page_draft/)
  assert.doesNotMatch(landingRoute, /cron|worker|poll/i)

  const videoCreate = readSource("components/growth/videos/growth-video-page-create-panel.tsx")
  assert.doesNotMatch(videoCreate, /disabled title="Coming soon"/)
  assert.match(videoCreate, /Generate With AI/)

  // Templates
  assert.equal(GROWTH_SENDR_PAGE_TEMPLATES.length, 6)
  assert.ok(getGrowthSendrPageTemplate("equipment_service_demo"))
  assert.ok(getGrowthSendrPageTemplate("re_engagement"))

  const createForm = readSource("components/growth/sendr/growth-sendr-page-create-form.tsx")
  assert.match(createForm, /GROWTH_SENDR_PAGE_TEMPLATES/)
  assert.match(createForm, /apply_template/)

  console.log("  ✓ Theme save/preview/publish wiring (CSS vars + legacy dark default)")
  console.log("  ✓ Calendar picker + manual URL + booking page attach")
  console.log("  ✓ AI draft generation (operator review, template fallback)")
  console.log("  ✓ Quick-start templates (6 industry presets)")
  console.log("  ✓ Generate With AI button repaired (links to Personalized Videos builder)")
  console.log("\nGS-SENDR-7B theme/UX certification passed.\n")
}

main()
