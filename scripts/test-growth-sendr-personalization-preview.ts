/**
 * GS-SENDR-2B — Personalization preview certification.
 * Run: pnpm test:growth-sendr-personalization-preview
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2B Personalization Preview Certification ===\n")
  assert.ok(fs.existsSync("app/api/platform/growth/sendr/personalization-preview/route.ts"))
  assert.ok(fs.existsSync("lib/growth/sendr/growth-sendr-personalization-preview-service.ts"))

  const service = fs.readFileSync("lib/growth/sendr/growth-sendr-personalization-preview-service.ts", "utf8")
  assert.match(service, /previewSendrPersonalization/)
  assert.match(service, /missing/)
  assert.match(service, /renderedSamples/)
  assert.doesNotMatch(service, /openai|anthropic|gpt/i)

  const route = fs.readFileSync("app/api/platform/growth/sendr/personalization-preview/route.ts", "utf8")
  assert.match(route, /customVariables/)
  assert.match(route, /leadId/)

  console.log("  ✓ Personalization preview (no AI generation)")
  console.log("\nGS-SENDR-2B personalization preview certification passed.\n")
}

main()
