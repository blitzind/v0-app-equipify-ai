/**
 * Growth Engine SP-UX-1 — Share page guided builder certification.
 *
 * Local: pnpm test:growth-share-pages-builder
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { growthSharePagePersonalizationScore } from "../components/growth/share-pages/growth-share-page-review-card"

const QA_MARKER = "growth-share-page-builder-sp-ux-1-v1"

const REQUIRED_FILES = [
  "components/growth/share-pages/growth-share-page-step-card.tsx",
  "components/growth/share-pages/growth-share-page-preview-card.tsx",
  "components/growth/share-pages/growth-share-page-builder.tsx",
  "components/growth/share-pages/growth-share-page-recipient-picker.tsx",
  "components/growth/share-pages/growth-share-page-template-picker.tsx",
  "components/growth/share-pages/growth-share-page-review-card.tsx",
  "components/growth/share-pages/growth-share-page-manage-panel.tsx",
  "app/(growth)/growth/share-pages/manage/new/page.tsx",
  "app/(admin)/admin/growth/share-pages/manage/new/page.tsx",
] as const

function runLocalRegression(): void {
  console.log(`\n=== SP-UX-1 Share Page Builder (${QA_MARKER}) ===\n`)

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} builder module files exist`)

  const builder = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-page-builder.tsx"),
    "utf8",
  )
  assert.match(builder, /GrowthSharePageStepCard/)
  assert.match(builder, /GrowthSharePagePreviewCard/)
  assert.match(builder, /GrowthSharePageRecipientPicker/)
  assert.match(builder, /GrowthSharePageTemplatePicker/)
  assert.match(builder, /GrowthSharePageReviewCard/)
  assert.match(builder, /max-w-\[1200px\]/)
  assert.match(builder, /lg:grid-cols-5/)
  assert.match(builder, /lg:col-span-3/)
  assert.match(builder, /lg:col-span-2/)
  assert.match(builder, /space-y-8/)
  assert.match(builder, /GrowthSharePageBrandingFields/)
  assert.match(builder, /GrowthSharePageBookingPagePicker/)
  assert.match(builder, /GrowthSharePageAiDraftPanel/)
  assert.match(builder, /GrowthStickyActionBar/)
  assert.match(builder, /GrowthWorkspaceSafeArea/)
  assert.match(builder, /form=\{FORM_ID\}/)
  assert.match(builder, /Generate With AI/)
  assert.match(builder, /Advanced settings/)
  assert.match(builder, /aria-expanded/)
  assert.ok(!builder.includes('Label className="text-xs">Lead ID'))
  assert.ok(!builder.match(/Lead ID \*/))
  console.log("  ✓ guided builder layout, steps, AIden-safe sticky footer, advanced collapse")

  const managePanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-page-manage-panel.tsx"),
    "utf8",
  )
  assert.match(managePanel, /manageBasePath/)
  assert.match(managePanel, /\$\{manageBasePath\}\/new/)
  assert.ok(!managePanel.includes('growthFeaturePath(pathname, "share-pages/manage/new")'))
  assert.ok(!managePanel.includes("Lead ID *"))
  assert.ok(!managePanel.includes("showCreate"))
  console.log("  ✓ manage panel routes to builder (no inline UUID form)")

  const previewCard = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-page-preview-card.tsx"),
    "utf8",
  )
  assert.match(previewCard, /aria-label="Live share page preview"/)
  assert.match(previewCard, /Hero image/)
  assert.match(previewCard, /headline/)
  assert.match(previewCard, /footerText/)
  console.log("  ✓ live preview card renders hero/headline/body/cta/footer")

  const recipientPicker = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-page-recipient-picker.tsx"),
    "utf8",
  )
  assert.match(recipientPicker, /calls\/workspace\/leads\/search/)
  assert.match(recipientPicker, /fitScoreLabel/)
  console.log("  ✓ recipient picker uses lead search API")

  const templatePicker = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-page-template-picker.tsx"),
    "utf8",
  )
  assert.match(templatePicker, /previewImageUrl/)
  assert.match(templatePicker, /Preview template/)
  console.log("  ✓ template picker shows cards with preview links")

  const score = growthSharePagePersonalizationScore({
    recipient: {
      leadId: "00000000-0000-4000-8000-000000000001",
      displayName: "Alex Rivera",
      companyName: "Summit",
      email: "alex@example.com",
      fitScoreLabel: "82%",
      lastActivityLabel: "Matched on email",
    },
    template: null,
    headline: "Hello Alex",
    introCopy: "Personal intro",
    ctaText: "Book",
    ctaUrl: "https://example.com",
    calendarUrl: "https://cal.com/demo",
    heroImageUrl: "",
  })
  assert.ok(score >= 60)
  console.log("  ✓ personalization score helper")

  const adminPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/share-pages/growth-share-pages-admin-panel.tsx"),
    "utf8",
  )
  assert.match(adminPanel, /GrowthSharePagesManagePanel/)
  assert.match(adminPanel, /GrowthSharePageDetailPanel/)
  console.log("  ✓ admin panel re-exports manage panel + detail panel")

  console.log("\nSP-UX-1 Share Page Builder local regression PASS\n")
}

runLocalRegression()

console.log(
  JSON.stringify({
    ok: true,
    qa_marker: QA_MARKER,
    hint: "Run pnpm test:growth-share-pages and pnpm test:growth-workspace-shell for required regressions",
  }),
)
