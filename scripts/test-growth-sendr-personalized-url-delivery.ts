/**
 * GS-SENDR-3D — Personalized URL delivery certification.
 * Run: pnpm test:growth-sendr-personalized-url-delivery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_PAGE_URL_MERGE_TOKEN,
  GROWTH_SENDR_PERSONALIZED_URL_DELIVERY_QA_MARKER,
} from "../lib/growth/sendr/growth-sendr-config"
import {
  buildSendrPersonalizedVisitorLink,
  resolveSendrExternalPageUrl,
} from "../lib/growth/sendr/growth-sendr-personalized-url-service"
import { buildSendrPagePublicLink } from "../lib/growth/sendr/growth-sendr-slug-runtime"
import {
  createSendrVisitorAccessToken,
  verifySendrVisitorToken,
} from "../lib/growth/sendr/growth-sendr-visitor-token"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3D Personalized URL Delivery Certification ===\n")

  assert.equal(
    GROWTH_SENDR_PERSONALIZED_URL_DELIVERY_QA_MARKER,
    "growth-sendr-personalized-url-delivery-gs-sendr-3d-v1",
  )

  const urlService = readSource("lib/growth/sendr/growth-sendr-personalized-url-service.ts")
  assert.match(urlService, /buildSendrPersonalizedVisitorLink/)
  assert.match(urlService, /resolveSendrExternalPageUrl/)
  assert.match(urlService, /createSendrVisitorAccessToken/)
  assert.doesNotMatch(urlService, /leadId.*params\.set\("leadId"/)

  const bridge = readSource("lib/growth/sendr/growth-sendr-sequence-bridge-service.ts")
  assert.match(bridge, /resolveSendrExternalPageUrl/)
  assert.match(bridge, /leadId\?: string \| null/)
  assert.doesNotMatch(bridge, /buildSendrPagePublicLink\(slug\)/)

  const sendBuilder = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(sendBuilder, /resolveSendrPageUrlForSequenceStep/)
  assert.match(sendBuilder, /leadId: input\.leadId/)

  const launchPreview = readSource("lib/growth/sendr/growth-sendr-launch-preview-service.ts")
  assert.match(launchPreview, /buildSendrEnrollmentPageAttachment/)
  assert.match(launchPreview, /leadId: sampleLeadId/)

  const assetPicker = readSource("lib/growth/sendr/growth-sendr-asset-picker-service.ts")
  assert.match(assetPicker, /resolveSendrExternalPageUrl/)
  assert.match(assetPicker, /leadId\?: string \| null/)

  console.log("  ✓ External URL builders prefer tokenized delivery")

  assert.equal(
    buildSendrPagePublicLink("acme-demo"),
    "https://app.equipify.ai/sendr/acme-demo",
  )
  console.log("  ✓ Anonymous bare slug URLs unchanged")

  const leadId = "11111111-1111-4111-8111-111111111111"
  const pageId = "22222222-2222-4222-8222-222222222222"
  const slug = "acme-demo"

  const tokenized = resolveSendrExternalPageUrl({ slug, landingPageId: pageId, leadId })
  assert.match(tokenized, /^https:\/\/app\.equipify\.ai\/sendr\/acme-demo\?token=/)
  assert.doesNotMatch(tokenized, /leadId=/)
  assert.ok(verifySendrVisitorToken(new URL(tokenized).searchParams.get("token") ?? "", pageId))

  const anonymous = resolveSendrExternalPageUrl({ slug, landingPageId: pageId })
  assert.equal(anonymous, "https://app.equipify.ai/sendr/acme-demo")

  const direct = buildSendrPersonalizedVisitorLink({ slug, landingPageId: pageId, leadId })
  assert.match(direct, /\?token=/)
  assert.doesNotMatch(direct, /leadId=/)
  console.log("  ✓ Lead context → tokenized URL; missing lead → bare slug")

  const expiredToken = createSendrVisitorAccessToken({
    leadId,
    landingPageId: pageId,
    expiresAt: new Date(Date.now() - 60_000),
  })
  assert.equal(verifySendrVisitorToken(expiredToken, pageId), null)
  assert.equal(verifySendrVisitorToken("tampered.token", pageId), null)
  console.log("  ✓ Token validation: invalid, expired, tampered")

  const merged = `Hi {{first_name}}, ${GROWTH_SENDR_PAGE_URL_MERGE_TOKEN}`
  const resolved = merged.replace(GROWTH_SENDR_PAGE_URL_MERGE_TOKEN, tokenized)
  assert.match(resolved, /\?token=/)
  assert.doesNotMatch(resolved, /\{\{sendr_page_url\}\}/)
  console.log("  ✓ {{sendr_page_url}} resolves to tokenized URL shape")

  const client = readSource("components/sendr/sendr-public-page-client.tsx")
  assert.doesNotMatch(client, /setInterval|WebSocket|subscribe|poll/i)

  console.log("\nGS-SENDR-3D personalized URL delivery certification passed.\n")
}

main()
