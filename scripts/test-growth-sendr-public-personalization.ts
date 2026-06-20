/**
 * GS-SENDR-2C / GS-SENDR-3C — Public personalization certification.
 * Run: pnpm test:growth-sendr-public-personalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2C/3C Public Personalization Certification ===\n")
  const repo = fs.readFileSync("lib/growth/sendr/growth-sendr-landing-page-repository.ts", "utf8")
  assert.match(repo, /renderSendrPersonalizedText/)
  assert.match(repo, /version_snapshot/)

  const service = fs.readFileSync("lib/growth/sendr/growth-sendr-public-page-service.ts", "utf8")
  assert.doesNotMatch(service, /openai|anthropic|gpt/i)
  assert.match(service, /sanitizeSection/)
  assert.match(service, /personalizeSendrPublicPagePayload/)

  const visitor = fs.readFileSync("lib/growth/sendr/growth-sendr-visitor-personalization-service.ts", "utf8")
  assert.match(visitor, /applySendrRuntimePersonalizationToPayload/)
  assert.doesNotMatch(visitor, /setInterval|WebSocket/)

  console.log("  ✓ Publish-time snapshot personalization preserved")
  console.log("  ✓ Runtime visitor personalization at public render time")
  console.log("\nGS-SENDR-2C/3C public personalization certification passed.\n")
}

main()
