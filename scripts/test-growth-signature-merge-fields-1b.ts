/**
 * GS-GROWTH-SIGNATURES-1B — sender merge field tests.
 * Run: pnpm test:growth-signature-merge-fields-1b
 */
import assert from "node:assert/strict"
import {
  applySenderMergeFieldsToText,
  buildSenderMergeFields,
  GROWTH_SENDER_MERGE_FIELD_KEYS,
} from "../lib/growth/signatures/sender-merge-fields"
import type { GrowthSenderProfile } from "../lib/growth/signatures/signature-types"

function sampleProfile(overrides: Partial<GrowthSenderProfile> = {}): GrowthSenderProfile {
  return {
    id: "profile-1",
    sender_account_id: "sender-1",
    mailbox_connection_id: null,
    display_name: "Michael Short",
    title: "Founder",
    email: "mike@equipifyai.com",
    phone: "865-555-0100",
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
    ...overrides,
  }
}

function testAllMergeKeysPresent() {
  const fields = buildSenderMergeFields(sampleProfile(), "fallback@example.com")
  for (const key of GROWTH_SENDER_MERGE_FIELD_KEYS) {
    assert.ok(Object.prototype.hasOwnProperty.call(fields, key))
    assert.equal(typeof fields[key], "string")
  }
}

function testNameSplitting() {
  const fields = buildSenderMergeFields(sampleProfile(), "mike@equipifyai.com")
  assert.equal(fields["sender.name"], "Michael Short")
  assert.equal(fields["sender.first_name"], "Michael")
  assert.equal(fields["sender.last_name"], "Short")
}

function testMissingFieldsEmptyString() {
  const fields = buildSenderMergeFields(
    sampleProfile({ title: null, phone: null, website: null }),
    "sender@example.com",
    "Sender Only",
  )
  assert.equal(fields["sender.title"], "")
  assert.equal(fields["sender.phone"], "")
  assert.equal(fields["sender.website"], "")
  assert.equal(fields["sender.company"], "")
}

function testFallbackWithoutProfile() {
  const fields = buildSenderMergeFields(null, "daniel@goequipify.com", "Daniel Rivera")
  assert.equal(fields["sender.email"], "daniel@goequipify.com")
  assert.equal(fields["sender.name"], "Daniel Rivera")
  assert.equal(fields["sender.first_name"], "Daniel")
  assert.equal(fields["sender.last_name"], "Rivera")
}

function testApplyMergeFields() {
  const fields = buildSenderMergeFields(sampleProfile(), "mike@equipifyai.com")
  const rendered = applySenderMergeFieldsToText(
    "Hi — {{sender.first_name}} from {{sender.company}} ({{sender.email}})",
    fields,
  )
  assert.equal(rendered, "Hi — Michael from equipify.ai (mike@equipifyai.com)")
}

function testLegacyUnderscoreTokens() {
  const fields = buildSenderMergeFields(sampleProfile(), "mike@equipifyai.com", null, "— Michael")
  const rendered = applySenderMergeFieldsToText("{{sender_name}} · {{sender_title}} · {{sender_email}}", fields)
  assert.equal(rendered, "Michael Short · Founder · mike@equipifyai.com")
}

function testApplyMergeFieldsMissingNeverThrows() {
  const rendered = applySenderMergeFieldsToText("Hello {{sender.name}}", {})
  assert.equal(rendered, "Hello ")
}

function testUnknownTokensLeftUnchanged() {
  const rendered = applySenderMergeFieldsToText("{{lead.company_name}}", buildSenderMergeFields(null, "a@b.com"))
  assert.equal(rendered, "{{lead.company_name}}")
}

const tests: Array<{ name: string; fn: () => void }> = [
  { name: "all merge keys present", fn: testAllMergeKeysPresent },
  { name: "name splitting", fn: testNameSplitting },
  { name: "missing fields empty string", fn: testMissingFieldsEmptyString },
  { name: "fallback without profile", fn: testFallbackWithoutProfile },
  { name: "apply merge fields", fn: testApplyMergeFields },
  { name: "legacy underscore tokens", fn: testLegacyUnderscoreTokens },
  { name: "missing merge never throws", fn: testApplyMergeFieldsMissingNeverThrows },
  { name: "unknown tokens unchanged", fn: testUnknownTokensLeftUnchanged },
]

let failed = 0
for (const t of tests) {
  try {
    t.fn()
    console.log(`ok\t${t.name}`)
  } catch (e) {
    failed += 1
    console.error(`fail\t${t.name}`)
    console.error(e)
  }
}

if (failed > 0) process.exit(1)
console.log(`\nAll ${tests.length} growth-signature-merge-fields-1b tests passed.`)
