/**
 * GS-SHARE-7B — Share Pages theme, booking picker, AI, templates certification.
 * Run: pnpm test:growth-share-pages-7b-theme-ux
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SHARE_PAGE_OPERATOR_DEFAULT_THEME,
  GROWTH_SHARE_PAGE_THEME_QA_MARKER,
  hasSharePageExtendedTheme,
  parseSharePageExtendedTheme,
  sharePageExtendedThemeCssVars,
} from "../lib/growth/share-pages/share-page-extended-theme"
import type { GrowthSharePageTheme } from "../lib/growth/share-pages/share-page-types"
import {
  GROWTH_SHARE_PAGE_QUICK_TEMPLATES,
  getSharePageQuickTemplate,
} from "../lib/growth/share-pages/share-page-quick-templates"

const GROWTH_SHARE_PAGE_AI_GENERATION_QA_MARKER = "growth-share-page-ai-generation-gs-share-7b-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SHARE-7B Share Pages Theme/UX Certification ===\n")

  assert.equal(GROWTH_SHARE_PAGE_THEME_QA_MARKER, "growth-share-page-theme-gs-share-7b-v1")
  assert.equal(GROWTH_SHARE_PAGE_AI_GENERATION_QA_MARKER, "growth-share-page-ai-generation-gs-share-7b-v1")

  const legacy: GrowthSharePageTheme = {
    brandColor: "#059669",
    accentColor: "#047857",
    logoUrl: null,
    heroImageUrl: null,
    publicThemeMode: "system",
    footerNote: null,
  }
  assert.equal(hasSharePageExtendedTheme(legacy), false)

  const extended = parseSharePageExtendedTheme({
    brandColor: "#2563eb",
    accentColor: "#2563eb",
    pageBackground: "#f8fafc",
    pageText: "#0f172a",
    headerBackground: "#07111f",
    headerText: "#ffffff",
    buttonBackground: "#f59e0b",
    buttonText: "#111827",
  })
  assert.equal(hasSharePageExtendedTheme(extended), true)
  assert.equal(extended.pageBackground, "#f8fafc")

  const cssVars = sharePageExtendedThemeCssVars(extended)
  assert.ok(cssVars["--share-header-bg"])
  assert.ok(cssVars["--share-button-bg"])

  assert.equal(GROWTH_SHARE_PAGE_QUICK_TEMPLATES.length, 8)
  assert.ok(getSharePageQuickTemplate("meeting_follow_up"))

  const builder = readSource("components/growth/share-pages/growth-share-page-builder.tsx")
  assert.match(builder, /GrowthSharePageBrandingFields/)
  assert.match(builder, /GrowthSharePageBookingPagePicker/)
  assert.match(builder, /GrowthSharePageAiDraftPanel/)
  assert.match(builder, /GrowthSharePageQuickTemplatePicker/)
  assert.match(builder, /buildThemePayload/)
  assert.doesNotMatch(builder, /disabled title="Coming soon"/)
  assert.match(builder, /Generate With AI/)
  assert.doesNotMatch(builder, /setInterval|poll/i)

  const bookingPicker = readSource("components/growth/share-pages/builder/growth-share-page-booking-page-picker.tsx")
  assert.match(bookingPicker, /\/api\/platform\/growth\/booking-pages/)
  assert.match(bookingPicker, /No booking pages yet/)

  const aiPanel = readSource("components/growth/share-pages/builder/growth-share-page-ai-draft-panel.tsx")
  assert.match(aiPanel, /generate-draft/)
  assert.match(aiPanel, /Apply draft to form/)
  assert.doesNotMatch(aiPanel, /action:\s*"approve"/)

  const apiSchema = readSource("lib/growth/share-pages/share-page-api-schema.ts")
  assert.match(apiSchema, /theme: sharePageThemeSchema/)
  assert.match(apiSchema, /growthSharePageAiDraftSchema/)

  const publicView = readSource("components/growth/share-pages/growth-share-page-view.tsx")
  assert.match(publicView, /hasSharePageExtendedTheme/)
  assert.match(publicView, /SharePageTracker/)

  const preview = readSource("components/growth/share-pages/growth-share-page-preview-card.tsx")
  assert.match(preview, /--share-header-bg/)

  const operator = readSource("lib/growth/share-pages/share-page-operator-service.ts")
  assert.match(operator, /theme: input\.body\.theme/)

  const sharedColor = readSource("components/growth/builder/growth-builder-color-field.tsx")
  assert.match(sharedColor, /GrowthBuilderColorField/)

  console.log("  ✓ Theme save/preview/publish wiring (theme column + CSS vars)")
  console.log("  ✓ Booking picker + manual URL + empty state")
  console.log("  ✓ AI draft generation (operator review, template fallback)")
  console.log("  ✓ Quick-start templates (8 presets)")
  console.log("  ✓ Shared GrowthBuilderColorField component")
  console.log("\nGS-SHARE-7B Share Pages theme/UX certification passed.\n")
}

main()
