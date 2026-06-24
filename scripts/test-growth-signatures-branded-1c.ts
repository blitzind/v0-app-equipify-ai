/**
 * GS-GROWTH-SIGNATURES-BRANDED-1C — branded sender signature templates.
 * Run: pnpm test:growth-signatures-branded-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { appendSignatureToOutboundBody } from "../lib/growth/signatures/signature-injection"
import { GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL } from "../lib/growth/signatures/signature-profile-defaults"
import { renderSignatureTemplate } from "../lib/growth/signatures/signature-template-render"
import { GROWTH_SIGNATURE_TEMPLATES } from "../lib/growth/signatures/signature-types"

const michaelShortBase = {
  display_name: "Michael Short",
  title: "Founder",
  email: "mike@equipify.ai",
  phone: "(562) 362-5489",
  company_name: "Equipify.ai",
  company_tagline: "Field Service Infrastructure for Biomedical Organizations",
  website: "https://equipify.ai",
  logo_url: "https://cdn.example.com/equipify-logo.png",
  booking_url: "https://equipify.ai/demo",
  booking_label: GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL,
  show_email_in_signature: false,
  show_phone_in_signature: true,
  show_website_in_signature: true,
  show_booking_cta: true,
}

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function testWebsiteNotDuplicated() {
  const simple = renderSignatureTemplate("simple", {
    ...michaelShortBase,
    booking_url: null,
    show_booking_cta: false,
  })
  assert.ok(!simple.text.includes("https://"))
  assert.equal((simple.text.match(/Equipify\.ai/g) ?? []).length, 1)
  assert.equal((simple.html.match(/href="https:\/\/equipify\.ai"/g) ?? []).length, 1)
  assert.doesNotMatch(simple.html, /362-5489[\s\S]*https:\/\/equipify\.ai/)
  console.log("  ✓ Website URL does not render twice")
}

function testCompanyNameClickable() {
  const simple = renderSignatureTemplate("simple", michaelShortBase)
  assert.match(simple.html, /<a href="https:\/\/equipify\.ai"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/)
  assert.match(simple.html, />Equipify\.ai</)
  console.log("  ✓ Company name renders as clickable link")
}

function testSimpleTextFallbackClean() {
  const simple = renderSignatureTemplate("simple", {
    ...michaelShortBase,
    booking_url: null,
    show_booking_cta: false,
  })
  assert.equal(
    simple.text,
    ["Michael Short", "Founder", "Equipify.ai", "(562) 362-5489"].join("\n"),
  )
  console.log("  ✓ Simple template text fallback is clean")
}

function testProfessionalLogoAndBooking() {
  const professional = renderSignatureTemplate("professional", michaelShortBase)
  assert.match(professional.html, /<img[^>]+equipify-logo\.png/)
  assert.match(professional.html, />Schedule a 15-minute demo</)
  assert.match(professional.html, /href="https:\/\/equipify\.ai\/demo"/)
  console.log("  ✓ Professional template includes logo and booking CTA when enabled")
}

function testBookingCtaOmittedWhenDisabled() {
  const out = renderSignatureTemplate("professional", {
    ...michaelShortBase,
    show_booking_cta: false,
  })
  assert.ok(!out.text.includes(GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL))
  assert.ok(!out.html.includes(GROWTH_SIGNATURE_DEFAULT_BOOKING_LABEL))
  console.log("  ✓ Booking CTA omitted when disabled")
}

function testEmailOmittedWhenDisabled() {
  const out = renderSignatureTemplate("professional", {
    ...michaelShortBase,
    show_email_in_signature: false,
  })
  assert.ok(!out.text.includes("mike@equipify.ai"))
  assert.ok(!out.html.includes("mike@equipify.ai"))
  console.log("  ✓ Email line omitted when show_email_in_signature=false")
}

function testPhoneIncludedWhenEnabled() {
  const out = renderSignatureTemplate("simple", {
    ...michaelShortBase,
    show_phone_in_signature: true,
  })
  assert.match(out.text, /\(562\) 362-5489/)
  assert.match(out.html, /\(562\) 362-5489/)
  console.log("  ✓ Phone line included when show_phone_in_signature=true")
}

function testLegacyTemplatesStillRender() {
  for (const template of ["simple", "minimal", "branded"] as const) {
    const out = renderSignatureTemplate(template, michaelShortBase)
    assert.ok(out.html.length > 0)
    assert.ok(out.text.length > 0)
    assert.equal(out.template, template)
  }
  console.log("  ✓ Existing simple/minimal/branded signatures still render")
}

function testOutboundInjectionUnchanged() {
  const sig = renderSignatureTemplate("simple", michaelShortBase)
  const result = appendSignatureToOutboundBody({
    htmlBody: "<p>Hello</p>",
    textBody: "Hello",
    signature: sig,
  })
  assert.equal(result.signatureInjected, true)
  assert.match(result.htmlBody, /Michael Short/)
  console.log("  ✓ Outbound signature injection still works")
}

function testProfessionalTemplateRegistered() {
  assert.ok(GROWTH_SIGNATURE_TEMPLATES.includes("professional"))
  const migration = readSource(
    "supabase/migrations/20270935120000_growth_sender_profiles_branded_signatures_1c.sql",
  )
  assert.match(migration, /company_tagline/)
  assert.match(migration, /professional/)
  console.log("  ✓ Professional template and migration present")
}

function testNoLegacyVendorReferencesInSignatureModules() {
  const legacyVendorToken = ["SEND", "R"].join("")
  const files = [
    "lib/growth/signatures/signature-template-render.ts",
    "lib/growth/signatures/signature-profile-defaults.ts",
    "lib/growth/signatures/signature-profile-api-schema.ts",
    "components/growth/signatures/growth-email-signatures-panel.tsx",
  ]
  for (const rel of files) {
    const source = readSource(rel)
    assert.ok(!source.includes(legacyVendorToken), `unexpected legacy vendor token in ${rel}`)
  }
  console.log("  ✓ No internal legacy vendor references in new signature work")
}

function runTests(): void {
  console.log("\n=== GS-GROWTH-SIGNATURES-BRANDED-1C ===\n")
  testWebsiteNotDuplicated()
  testCompanyNameClickable()
  testSimpleTextFallbackClean()
  testProfessionalLogoAndBooking()
  testBookingCtaOmittedWhenDisabled()
  testEmailOmittedWhenDisabled()
  testPhoneIncludedWhenEnabled()
  testLegacyTemplatesStillRender()
  testOutboundInjectionUnchanged()
  testProfessionalTemplateRegistered()
  testNoLegacyVendorReferencesInSignatureModules()
  console.log("\nGS-GROWTH-SIGNATURES-BRANDED-1C passed.\n")
}

runTests()
