/**
 * GS-SENDR-2C — Share links certification.
 * Run: pnpm test:growth-sendr-share-links
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import { buildSendrPagePublicLink } from "../lib/growth/sendr/growth-sendr-slug-runtime"

function main(): void {
  console.log("\n=== GS-SENDR-2C Share Links Certification ===\n")
  assert.equal(buildSendrPagePublicLink("acme-intro-a1b2c3d4"), "https://app.equipify.ai/videos/acme-intro-a1b2c3d4")

  const detail = fs.readFileSync("components/growth/sendr/growth-sendr-page-detail.tsx", "utf8")
  assert.match(detail, /Open page/)
  assert.match(detail, /buildSendrPagePublicLink|buildSendrPagePublicPath/)
  assert.doesNotMatch(detail, /Copy link[\s\S]*\/growth\/sendr\/\$\{pageId\}/)

  const route = fs.readFileSync("app/api/platform/growth/sendr/landing-pages/route.ts", "utf8")
  assert.match(route, /publishedSlug/)

  console.log("  ✓ Operator share links use /videos/[slug]")
  console.log("\nGS-SENDR-2C share links certification passed.\n")
}

main()
