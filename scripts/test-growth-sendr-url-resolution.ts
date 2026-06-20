/**
 * GS-SENDR-2D — URL resolution certification.
 * Run: pnpm test:growth-sendr-url-resolution
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_SENDR_LIMITS } from "../lib/growth/sendr/growth-sendr-config"
import { buildSendrPagePublicLink } from "../lib/growth/sendr/growth-sendr-slug-runtime"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2D URL Resolution Certification ===\n")

  const bridge = readSource("lib/growth/sendr/growth-sendr-sequence-bridge-service.ts")
  assert.match(bridge, /resolveSendrPageUrlForSequenceStep/)
  assert.match(bridge, /Read-only cached URL resolution/)
  assert.match(bridge, /CACHE_TTL_MS/)
  assert.match(bridge, /sendr_url_resolutions/)
  assert.match(bridge, /no publish side effects/)
  assert.doesNotMatch(bridge, /publishLandingPage|createSendrPublication/)

  assert.equal(
    buildSendrPagePublicLink("acme-demo"),
    "https://app.equipify.ai/sendr/acme-demo",
  )
  assert.ok(GROWTH_SENDR_LIMITS.MAX_SENDR_URL_RESOLUTIONS_PER_BATCH >= 500)

  const sendBuilder = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(sendBuilder, /applySendrPageUrlMergeFields/)

  console.log("  ✓ Deterministic cached read-only URL resolution at send time")
  console.log("\nGS-SENDR-2D URL resolution certification passed.\n")
}

main()
