/**
 * GS-GROWTH-SIGNATURES-BOOKING-1D — signature booking page picker certification.
 * Run: pnpm test:growth-signatures-booking-1d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthBookingPagePublicUrl,
  findSignatureBookingOptionByUrl,
  formatSignatureBookingOptionLabel,
  GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER,
  resolveSignatureBookingSourceFromUrl,
} from "../lib/growth/booking/booking-page-signature-options-types"
import { GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL } from "../lib/growth/signatures/signature-profile-defaults"
import { renderSignatureTemplate } from "../lib/growth/signatures/signature-template-render"

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function testOptionsEndpoint() {
  const route = readSource("app/api/platform/growth/booking-pages/options/route.ts")
  assert.match(route, /listGrowthSignatureBookingOptions/)
  assert.match(route, /GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER/)
  assert.match(route, /options/)
  console.log("  ✓ Booking options endpoint returns existing booking pages")
}

function testOptionsService() {
  const service = readSource("lib/growth/booking/booking-page-signature-options-service.ts")
  assert.match(service, /listGrowthBookingPagesForOwner/)
  assert.match(service, /type: "booking_page"/)
  assert.doesNotMatch(service, /sendr/i)
  console.log("  ✓ Options service reuses booking page repository")
}

function testSignatureEditorUi() {
  const panel = readSource("components/growth/signatures/growth-email-signatures-panel.tsx")
  assert.match(panel, /GrowthSignatureBookingCtaFields/)

  const fields = readSource("components/growth/signatures/growth-signature-booking-cta-fields.tsx")
  assert.match(fields, /Booking source/)
  assert.match(fields, /Manual URL/)
  assert.match(fields, /Existing booking page/)
  assert.match(fields, /\/api\/platform\/growth\/booking-pages\/options/)
  assert.match(fields, /Use custom URL instead/)
  assert.match(fields, /Show booking CTA in signature/)
  console.log("  ✓ Signature editor displays booking source selector and page picker")
}

function testOptionSelectionHelpers() {
  const options = [
    {
      id: "page-1",
      type: "booking_page" as const,
      label: "Equipify Demo / Michael Short",
      url: "https://app.equipify.ai/book/equipify-demo",
      ownerName: "Michael Short",
    },
  ]

  assert.equal(
    buildGrowthBookingPagePublicUrl("https://app.equipify.ai", "equipify-demo"),
    "https://app.equipify.ai/book/equipify-demo",
  )
  assert.equal(
    formatSignatureBookingOptionLabel({
      pageTitle: "Equipify Demo",
      name: "demo",
      ownerName: "Michael Short",
    }),
    "Equipify Demo / Michael Short",
  )

  const match = findSignatureBookingOptionByUrl("https://app.equipify.ai/book/equipify-demo/", options)
  assert.ok(match)
  assert.equal(match?.id, "page-1")

  const resolved = resolveSignatureBookingSourceFromUrl(
    "https://app.equipify.ai/book/equipify-demo",
    options,
  )
  assert.equal(resolved.source, "existing")
  assert.equal(resolved.pageId, "page-1")
  assert.equal(resolved.customUrl, false)

  const manual = resolveSignatureBookingSourceFromUrl("https://cal.com/demo", options)
  assert.equal(manual.source, "manual")
  console.log("  ✓ Selecting existing booking page resolves URL + source state")
}

function testManualUrlStillWorks() {
  const fields = readSource("components/growth/signatures/growth-signature-booking-cta-fields.tsx")
  assert.match(fields, /placeholder="https:\/\/equipify\.ai\/demo"/)
  assert.match(fields, /Manual URL/)
  console.log("  ✓ Manual URL fallback remains available")
}

function testExistingProfilesRender() {
  const html = renderSignatureTemplate("professional", {
    display_name: "Michael Short",
    title: "Founder",
    email: "mike@equipify.ai",
    phone: "(562) 362-5489",
    company_name: "Equipify.ai",
    company_tagline: null,
    website: "https://equipify.ai",
    linkedin_url: null,
    avatar_url: null,
    logo_url: null,
    booking_url: "https://legacy.example.com/booking",
    booking_label: "Book time with me",
    show_email_in_signature: false,
    show_phone_in_signature: true,
    show_website_in_signature: true,
    show_booking_cta: true,
  })
  assert.match(html.html, /href="https:\/\/legacy\.example\.com\/booking"/)
  assert.match(html.text, /Book time with me/)
  console.log("  ✓ Existing profiles with stored booking_url continue rendering")
}

function testProfessionalPreviewUsesBookingUrl() {
  const bookingUrl = "https://app.equipify.ai/book/equipify-demo"
  const out = renderSignatureTemplate("professional", {
    display_name: "Michael Short",
    title: "Founder",
    email: "mike@equipify.ai",
    phone: null,
    company_name: "Equipify.ai",
    company_tagline: null,
    website: "https://equipify.ai",
    linkedin_url: null,
    avatar_url: null,
    logo_url: null,
    booking_url: bookingUrl,
    booking_label: GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL,
    show_email_in_signature: false,
    show_phone_in_signature: false,
    show_website_in_signature: true,
    show_booking_cta: true,
  })
  assert.match(out.html, />Schedule a 15-minute demo</)
  assert.match(out.html, new RegExp(`href="${bookingUrl.replace(/\//g, "\\/")}"`))
  console.log("  ✓ Professional preview uses selected booking URL")
}

function testNoMigration() {
  const migrations = fs
    .readdirSync(path.join(process.cwd(), "supabase/migrations"))
    .filter((name) => name.includes("signature") && name.includes("booking"))
  assert.equal(migrations.length, 0)
  console.log("  ✓ No migration required")
}

function testNoSendrReferences() {
  const files = [
    "components/growth/signatures/growth-signature-booking-cta-fields.tsx",
    "components/growth/signatures/growth-email-signatures-panel.tsx",
    "app/api/platform/growth/booking-pages/options/route.ts",
    "lib/growth/booking/booking-page-signature-options-service.ts",
    "lib/growth/booking/booking-page-signature-options-types.ts",
  ]
  for (const file of files) {
    assert.doesNotMatch(readSource(file), /sendr/i, `${file} must not reference SENDR`)
  }
  console.log("  ✓ No SENDR references added")
}

async function main() {
  console.log(`\n=== GS-GROWTH-SIGNATURES-BOOKING-1D (${GROWTH_SIGNATURE_BOOKING_OPTIONS_QA_MARKER}) ===\n`)
  testOptionsEndpoint()
  testOptionsService()
  testSignatureEditorUi()
  testOptionSelectionHelpers()
  testManualUrlStillWorks()
  testExistingProfilesRender()
  testProfessionalPreviewUsesBookingUrl()
  testNoMigration()
  testNoSendrReferences()
  console.log("\nAll GS-GROWTH-SIGNATURES-BOOKING-1D checks passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
