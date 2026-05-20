import assert from "node:assert/strict"

import { isDemoWorkspaceSlug } from "@/lib/demo-workspace/demo-workspace-slugs"
import {
  hasExtractedBusinessCardText,
  normalizeProspectBusinessCardFields,
  normalizeProspectEmail,
  normalizeProspectPhone,
} from "@/lib/prospects/prospect-business-card-normalize"
import {
  mimeForProspectBusinessCardKind,
  PROSPECT_BUSINESS_CARD_SCAN_MAX_BYTES,
  sniffProspectBusinessCardFileKind,
} from "@/lib/prospects/prospect-business-card-upload-validate"

function testDemoWorkspaceSlugs() {
  assert.equal(isDemoWorkspaceSlug("acme"), true)
  assert.equal(isDemoWorkspaceSlug("precision-biomedical-demo"), true)
  assert.equal(isDemoWorkspaceSlug("my-live-org"), false)
}

function testPhoneNormalization() {
  assert.equal(normalizeProspectPhone("5551234567"), "(555) 123-4567")
  assert.equal(normalizeProspectPhone("+1 (555) 123-4567"), "(555) 123-4567")
  assert.equal(normalizeProspectPhone(""), null)
}

function testEmailNormalization() {
  assert.equal(normalizeProspectEmail("Taylor@Example.com"), "taylor@example.com")
  assert.equal(normalizeProspectEmail("not-an-email"), "invalid")
}

function testWebsiteNormalization() {
  const fields = normalizeProspectBusinessCardFields({
    website: "example.com",
  })
  assert.equal(fields.website, "https://example.com/")
}

function testSniffJpeg() {
  const jpeg = Buffer.alloc(16)
  jpeg[0] = 0xff
  jpeg[1] = 0xd8
  jpeg[2] = 0xff
  assert.equal(sniffProspectBusinessCardFileKind(jpeg), "jpeg")
  assert.equal(mimeForProspectBusinessCardKind("jpeg"), "image/jpeg")
}

function testSniffRejectsPdf() {
  const pdf = Buffer.from("%PDF-1.4\n")
  assert.equal(sniffProspectBusinessCardFileKind(pdf), "unknown")
}

function testHasExtractedText() {
  assert.equal(hasExtractedBusinessCardText(normalizeProspectBusinessCardFields({})), false)
  assert.equal(
    hasExtractedBusinessCardText(normalizeProspectBusinessCardFields({ company_name: "Acme" })),
    true,
  )
}

function testMaxBytesConstant() {
  assert.equal(PROSPECT_BUSINESS_CARD_SCAN_MAX_BYTES, 10 * 1024 * 1024)
}

testDemoWorkspaceSlugs()
testPhoneNormalization()
testEmailNormalization()
testWebsiteNormalization()
testSniffJpeg()
testSniffRejectsPdf()
testHasExtractedText()
testMaxBytesConstant()

console.log("prospect business card scan tests passed")
