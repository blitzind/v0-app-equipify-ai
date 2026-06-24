/**
 * GS-SENDR-SIGNATURE-1A — company name vs website URL signature rendering.
 * Run: pnpm test:growth-sendr-signature-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildSenderMergeFields } from "../lib/growth/signatures/sender-merge-fields"
import {
  deriveCompanyLabelFromWebsite,
  resolveSignatureCompanyFields,
} from "../lib/growth/signatures/signature-company-fields"
import { renderSignatureTemplate } from "../lib/growth/signatures/signature-template-render"
import type { GrowthSenderProfile } from "../lib/growth/signatures/signature-types"
import { GROWTH_SIGNATURE_PROFILE_FIELD_DEFAULTS } from "../lib/growth/signatures/signature-profile-defaults"

const michaelShortSample = {
  display_name: "Michael Short",
  title: "Founder",
  phone: "(562) 362-5489",
  company_name: "Equipify.ai",
  website: "https://equipify.ai",
}

function sampleProfile(overrides: Partial<GrowthSenderProfile> = {}): GrowthSenderProfile {
  return {
    id: "profile-1",
    sender_account_id: "sender-1",
    mailbox_connection_id: null,
    display_name: "Michael Short",
    title: "Founder",
    email: "mike@equipify.ai",
    phone: "(562) 362-5489",
    company_name: "Equipify.ai",
    website: "https://equipify.ai",
    linkedin_url: null,
    avatar_url: null,
    logo_url: null,
    active: true,
    signature_template: "simple",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    ...GROWTH_SIGNATURE_PROFILE_FIELD_DEFAULTS,
    ...overrides,
  }
}

function runTests(): void {
  console.log("\n=== GS-SENDR-SIGNATURE-1A ===\n")

  const fields = resolveSignatureCompanyFields({
    company_name: "Equipify.ai",
    website: "https://equipify.ai",
  })
  assert.equal(fields.companyLabel, "Equipify.ai")
  assert.equal(fields.websiteHref, "https://equipify.ai")
  console.log("  ✓ resolveSignatureCompanyFields separates label and href")

  assert.equal(deriveCompanyLabelFromWebsite("equipify.ai"), "equipify.ai")
  assert.equal(
    resolveSignatureCompanyFields({ company_name: null, website: "https://equipify.ai" }).companyLabel,
    "equipify.ai",
  )
  console.log("  ✓ Legacy profiles without company_name derive label from website host")

  const simple = renderSignatureTemplate("simple", michaelShortSample)
  assert.equal(
    simple.text,
    ["Michael Short", "Founder", "Equipify.ai", "(562) 362-5489"].join("\n"),
  )
  assert.ok(!simple.text.includes("https://"))
  assert.match(simple.html, /<a href="https:\/\/equipify\.ai"/)
  assert.match(simple.html, />Equipify\.ai</)
  assert.doesNotMatch(simple.html, /362-5489[\s\S]*https:\/\/equipify\.ai/)
  console.log("  ✓ Simple template: company linked in HTML, URL omitted from plain text")

  const branded = renderSignatureTemplate("branded", michaelShortSample)
  assert.ok(!branded.text.includes("https://"))
  assert.match(branded.html, /<a href="https:\/\/equipify\.ai"/)
  assert.equal((branded.html.match(/https:\/\/equipify\.ai/g) ?? []).length, 1)
  console.log("  ✓ Branded template: single linked company line, no duplicate URL row")

  const mergeFields = buildSenderMergeFields(sampleProfile(), "mike@equipify.ai")
  assert.equal(mergeFields["sender.company"], "Equipify.ai")
  assert.equal(mergeFields["sender.website"], "https://equipify.ai")
  console.log("  ✓ Merge fields expose company label and website URL separately")

  const legacyMerge = buildSenderMergeFields(
    sampleProfile({ company_name: null, website: "equipify.ai" }),
    "mike@equipify.ai",
  )
  assert.equal(legacyMerge["sender.company"], "equipify.ai")
  assert.equal(legacyMerge["sender.website"], "equipify.ai")
  console.log("  ✓ Legacy profiles keep website-only backward compatibility")

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270934120000_growth_sender_profiles_company_name_gs_sendr_signature_1a.sql"),
    "utf8",
  )
  assert.match(migration, /company_name/)
  console.log("  ✓ Migration adds company_name column")

  const panelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/signatures/growth-email-signatures-panel.tsx"),
    "utf8",
  )
  assert.match(panelSource, /companyName/)
  assert.match(panelSource, /Website URL/)
  console.log("  ✓ Signatures panel exposes separate company + website fields")

  console.log("\nGS-SENDR-SIGNATURE-1A passed.\n")
}

runTests()
