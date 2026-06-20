/**
 * GS-SENDR-2A — Personalization runtime certification.
 * Run: pnpm test:growth-personalization-runtime
 */
import assert from "node:assert/strict"
import {
  GROWTH_SENDR_PERSONALIZATION_VARIABLES,
} from "../lib/growth/sendr/growth-sendr-config"
import {
  buildSendrCachedVariableMap,
  renderSendrPersonalizedText,
  resolveSendrPersonalizationVariables,
} from "../lib/growth/sendr/growth-sendr-personalization-runtime"

function main(): void {
  console.log("\n=== GS-SENDR-2A Personalization Runtime Certification ===\n")
  assert.ok(GROWTH_SENDR_PERSONALIZATION_VARIABLES.includes("first_name"))
  assert.ok(GROWTH_SENDR_PERSONALIZATION_VARIABLES.includes("meeting_link"))

  const map = buildSendrCachedVariableMap(
    { first_name: "Ada", company_name: "Equipify" },
    { full_name: "Mike" },
    { meeting_link: "https://book.example/ada" },
  )
  const resolved = resolveSendrPersonalizationVariables({ variables: map, fallbacks: { industry: "Dental" } })
  assert.equal(resolved.first_name, "Ada")
  assert.equal(resolved.industry, "Dental")

  const rendered = renderSendrPersonalizedText(
    "Hi {{first_name}} from {{owner_name}} at {{company_name}}",
    { variables: map, fallbacks: { owner_name: "Mike" } },
  )
  assert.equal(rendered, "Hi Ada from Mike at Equipify")

  console.log("  ✓ Deterministic server-side variable resolution")
  console.log("\nGS-SENDR-2A personalization runtime certification passed.\n")
}

main()
