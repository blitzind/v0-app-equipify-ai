/**
 * GS-AI-PLAYBOOK-1A — Industry resolver & playbook foundation certification.
 * Run: pnpm test:growth-industry-playbook-foundation
 */
import assert from "node:assert/strict"
import {
  GROWTH_INDUSTRY_IDS,
  GROWTH_INDUSTRY_TAXONOMY,
  listGrowthIndustryTaxonomy,
} from "../lib/growth/playbooks/industry-taxonomy"
import {
  assertIndustryPlaybookRegistryHealthy,
  getIndustryPlaybook,
  listIndustryPlaybooks,
  resolveIndustryPlaybook,
  GROWTH_INDUSTRY_PLAYBOOK_QA_MARKER,
} from "../lib/growth/playbooks/industry-playbook-registry"
import { resolveGrowthIndustry } from "../lib/growth/playbooks/industry-playbook-resolver"
import { validateGrowthIndustryPlaybook } from "../lib/growth/playbooks/industry-playbook-types"
import { GROWTH_INDUSTRY_SEEDED_PLAYBOOKS } from "../lib/growth/playbooks/playbooks"

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-1A Industry Playbook Foundation ===\n")

  assert.equal(GROWTH_INDUSTRY_PLAYBOOK_QA_MARKER, "growth-industry-playbook-foundation-gs-ai-playbook-1a-v1")
  assert.equal(GROWTH_INDUSTRY_IDS.length, 27)
  assert.equal(listGrowthIndustryTaxonomy().length, 27)
  console.log("  ✓ taxonomy loads (27 industries)")

  assertIndustryPlaybookRegistryHealthy()
  assert.equal(listIndustryPlaybooks().length, 27)
  console.log("  ✓ registry healthy — all industries registered")

  for (const playbook of GROWTH_INDUSTRY_SEEDED_PLAYBOOKS) {
    assert.deepEqual(validateGrowthIndustryPlaybook(playbook), [])
  }
  console.log("  ✓ every seeded playbook passes schema validation")

  const aliasMatch = resolveGrowthIndustry({
    companyName: "Sterling Biomedical Services",
    industry: "Healthcare",
  })
  assert.equal(aliasMatch.industryId, "biomedical_equipment")
  assert.ok(aliasMatch.confidence >= 62)
  assert.ok(aliasMatch.matchedSignals.some((signal) => signal.signalType === "company_name_hint"))
  console.log("  ✓ alias / company-name resolution (Sterling Biomedical → biomedical_equipment)")

  const naicsMatch = resolveGrowthIndustry({ naics: "811219" })
  assert.equal(naicsMatch.industryId, "biomedical_equipment")
  assert.equal(naicsMatch.confidence, 95)
  console.log("  ✓ NAICS matching (811219 → biomedical_equipment)")

  const keywordMatch = resolveGrowthIndustry({
    researchSummary: "Commercial HVAC contractor maintaining rooftop units across retail sites.",
  })
  assert.equal(keywordMatch.industryId, "commercial_hvac")
  assert.ok(keywordMatch.confidence >= 56)
  console.log("  ✓ research-text keyword resolution")

  const multiMatch = resolveGrowthIndustry({
    companyName: "Sierra Biomed Field Service",
    industry: "HVAC contractor",
    researchSummary: "Biomedical equipment HTM programs for regional hospitals.",
  })
  assert.equal(multiMatch.industryId, "biomedical_equipment")
  assert.ok(multiMatch.allMatches.length > 1)
  console.log("  ✓ multiple matches — highest confidence wins (biomedical over hvac hint)")

  const medtechMatch = resolveGrowthIndustry({ companyName: "OMI MedTech Solutions" })
  assert.ok(medtechMatch.industryId === "biomedical_equipment" || medtechMatch.industryId === "medical_equipment")
  console.log("  ✓ medtech company-name hint (OMI MedTech)")

  const playbookLookup = resolveIndustryPlaybook({
    companyName: "Henry Schein Medical",
    researchSummary: "Medical equipment distribution and service programs.",
  })
  assert.ok(playbookLookup.playbook)
  assert.equal(playbookLookup.playbook?.industryId, playbookLookup.resolution.industryId)
  console.log("  ✓ resolveIndustryPlaybook returns paired playbook")

  const hvacEntry = GROWTH_INDUSTRY_TAXONOMY.hvac_r
  assert.ok(hvacEntry.aliases.includes("hvac"))
  assert.ok(hvacEntry.naics.length > 0)
  const playbook = getIndustryPlaybook("hvac_r")
  assert.ok(playbook)
  assert.ok(playbook!.pains.length >= 3)
  console.log("  ✓ getIndustryPlaybook + taxonomy metadata")

  const noMatch = resolveGrowthIndustry({ companyName: "Acme Consulting LLC" })
  assert.equal(noMatch.industryId, null)
  assert.equal(noMatch.confidence, 0)
  console.log("  ✓ no false match for unrelated company name")

  console.log("\nGS-AI-PLAYBOOK-1A industry playbook foundation certification passed.\n")
}

main()
