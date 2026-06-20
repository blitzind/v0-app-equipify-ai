/**
 * Personalized Videos branding alignment certification.
 * Run: pnpm test:growth-sendr-branding-alignment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_PERSONALIZED_VIDEOS_BRANDING_QA_MARKER,
  GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL,
  GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH,
  GROWTH_PERSONALIZED_VIDEOS_LEGACY_PUBLIC_PATH,
} from "../lib/growth/sendr/growth-sendr-branding"
import { buildSendrPagePublicLink, buildSendrPagePublicPath } from "../lib/growth/sendr/growth-sendr-slug-runtime"
import { createSendrVisitorAccessToken, verifySendrVisitorToken } from "../lib/growth/sendr/growth-sendr-visitor-token"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== Personalized Videos Branding Alignment Certification ===\n")

  assert.equal(GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL, "Personalized Videos")
  assert.equal(GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH, "/videos")
  assert.equal(GROWTH_PERSONALIZED_VIDEOS_LEGACY_PUBLIC_PATH, "/sendr")
  assert.equal(
    GROWTH_PERSONALIZED_VIDEOS_BRANDING_QA_MARKER,
    "growth-personalized-videos-branding-v1",
  )

  assert.ok(fs.existsSync("app/videos/[slug]/page.tsx"))
  assert.ok(fs.existsSync("app/sendr/[slug]/page.tsx"))

  const legacyRoute = readSource("app/sendr/[slug]/page.tsx")
  assert.match(legacyRoute, /redirect\(/)
  assert.match(legacyRoute, /GROWTH_PERSONALIZED_VIDEOS_PUBLIC_PATH/)

  const canonicalRoute = readSource("app/videos/[slug]/page.tsx")
  assert.match(canonicalRoute, /GrowthSendrPublicPageView/)

  assert.equal(buildSendrPagePublicPath("acme-demo"), "/videos/acme-demo")
  assert.equal(
    buildSendrPagePublicLink("acme-demo"),
    "https://app.equipify.ai/videos/acme-demo",
  )

  const leadId = "11111111-1111-4111-8111-111111111111"
  const pageId = "22222222-2222-4222-8222-222222222222"
  const token = createSendrVisitorAccessToken({ leadId, landingPageId: pageId })
  const tokenized = buildSendrPagePublicLink("acme-demo", "https://app.equipify.ai", { token })
  assert.match(tokenized, /^https:\/\/app\.equipify\.ai\/videos\/acme-demo\?token=/)
  assert.ok(verifySendrVisitorToken(new URL(tokenized).searchParams.get("token") ?? "", pageId))

  const nav = readSource("lib/growth/navigation/growth-workspace-shell-navigation.ts")
  assert.match(nav, /Personalized Videos/)
  assert.match(nav, /personalized-videos/)

  const workspacePage = readSource("app/(growth)/growth/sendr/page.tsx")
  assert.match(workspacePage, /GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL/)
  assert.doesNotMatch(workspacePage, /title="SENDR"/)

  const shareLinks = readSource("scripts/test-growth-sendr-share-links.ts")
  assert.match(shareLinks, /\/videos\//)

  const publicPages = readSource("scripts/test-growth-sendr-public-pages.ts")
  assert.match(publicPages, /app\/videos\/\[slug\]\/page\.tsx/)

  const client = readSource("components/sendr/sendr-public-page-client.tsx")
  assert.doesNotMatch(client, /setInterval|WebSocket|subscribe|poll/i)

  console.log("  ✓ Canonical /videos/[slug] public routing")
  console.log("  ✓ Legacy /sendr/[slug] redirect compatibility")
  console.log("  ✓ Operator navigation and workspace branding")
  console.log("\nPersonalized Videos branding alignment certification passed.\n")
}

main()
