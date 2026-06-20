/**
 * GS-SENDR-2C — Public page route certification.
 * Run: pnpm test:growth-sendr-public-pages
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import { GROWTH_SENDR_PUBLIC_QA_MARKER } from "../lib/growth/sendr/growth-sendr-config"

function main(): void {
  console.log("\n=== GS-SENDR-2C Public Pages Certification ===\n")
  assert.equal(GROWTH_SENDR_PUBLIC_QA_MARKER, "growth-sendr-public-runtime-gs-sendr-2c-v1")
  assert.ok(fs.existsSync("app/videos/[slug]/page.tsx"))
  assert.ok(fs.existsSync("app/sendr/[slug]/page.tsx"))
  assert.ok(fs.existsSync("app/api/public/sendr/[slug]/route.ts"))
  assert.ok(fs.existsSync("components/sendr/sendr-public-page-client.tsx"))

  const client = fs.readFileSync("components/sendr/sendr-public-page-client.tsx", "utf8")
  assert.match(client, /page_view/)
  assert.match(client, /\/api\/public\/sendr\/events/)
  assert.doesNotMatch(client, /setInterval/)

  const legacyRoute = fs.readFileSync("app/sendr/[slug]/page.tsx", "utf8")
  assert.match(legacyRoute, /redirect\(/)

  console.log("  ✓ Public /videos/[slug] route with legacy /sendr redirect")
  console.log("\nGS-SENDR-2C public pages certification passed.\n")
}

main()
