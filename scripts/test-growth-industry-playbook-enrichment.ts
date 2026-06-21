/**
 * GS-AI-PLAYBOOK-2A certification — industry playbook enrichment.
 * Run: pnpm test:growth-industry-playbook-enrichment (and sibling aliases)
 */

import assert from "node:assert/strict"
import { resolveIndustryPlaybook } from "../lib/growth/playbooks/industry-playbook-registry"
import {
  assertValidGrowthIndustryPlaybook,
  GROWTH_INDUSTRY_PLAYBOOK_ENRICHMENT_QA_MARKER,
  isReferenceEnrichedPlaybook,
  validateGrowthIndustryPlaybook,
} from "../lib/growth/playbooks/industry-playbook-types"
import {
  auditIndustryPlaybookMatrix,
  summarizePlaybookAuditMatrix,
} from "../lib/growth/playbooks/playbooks/playbook-audit-utils"
import { GROWTH_INDUSTRY_PLAYBOOK_PRIORITY_ENRICHMENT_IDS } from "../lib/growth/playbooks/playbooks/_playbook-enrich-helper"
import { GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS } from "../lib/growth/playbooks/playbooks/enriched/priority-playbooks"
import { GROWTH_INDUSTRY_SEEDED_PLAYBOOKS } from "../lib/growth/playbooks/playbooks"

const CERT_SECTION = process.env.GS_PLAYBOOK_2A_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

function runSchemaCert(): void {
  for (const playbook of GROWTH_INDUSTRY_SEEDED_PLAYBOOKS) {
    assert.deepEqual(validateGrowthIndustryPlaybook(playbook), [])
  }
  console.log("✓ schema — all 27 playbooks validate")
}

function runEnrichmentCert(): void {
  assert.equal(GROWTH_INDUSTRY_PLAYBOOK_ENRICHMENT_QA_MARKER, "growth-industry-playbook-enrichment-gs-ai-playbook-2a-v1")
  for (const industryId of GROWTH_INDUSTRY_PLAYBOOK_PRIORITY_ENRICHMENT_IDS) {
    const builder = GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS[industryId]
    const playbook = builder()
    assertValidGrowthIndustryPlaybook(playbook)
    assert.equal(playbook.enrichmentLevel, "reference")
    assert.ok((playbook.operationalPains?.length ?? 0) >= 15)
    assert.ok((playbook.financialPains?.length ?? 0) >= 10)
    assert.ok((playbook.buyerPersonas?.length ?? 0) >= 5)
    assert.ok(playbook.discoveryQuestions.length >= 20)
    assert.ok(playbook.capabilityMappings.length >= 15)
    assert.ok(playbook.recommendedCtas.length >= 15)
    assert.ok((playbook.storylines?.length ?? 0) >= 15)
  }
  console.log("✓ enrichment — 10 priority industries meet reference minimums")
}

function runContentCert(): void {
  const biomedical = GROWTH_PRIORITY_ENRICHED_PLAYBOOK_BUILDERS.biomedical_equipment()
  assert.ok(biomedical.overview.length > 200)
  assert.ok(biomedical.personalizationOpeners?.some((entry) => /PM|recall|HTM/i.test(entry)))
  assert.ok(biomedical.industryVocabulary?.includes("CMMS") || biomedical.industryVocabulary?.includes("HTM"))
  assert.ok((biomedical.structuredObjections?.length ?? 0) >= 15)
  assert.ok((biomedical.competitiveLandscape?.length ?? 0) >= 5)
  console.log("✓ content — biomedical reference intelligence populated")
}

function runPriorityCert(): void {
  const enrichedCount = GROWTH_INDUSTRY_SEEDED_PLAYBOOKS.filter(isReferenceEnrichedPlaybook).length
  assert.equal(enrichedCount, 10)
  console.log("✓ priority industries — wired into registry as reference playbooks")
}

function runRegressionCert(): void {
  const resolution = resolveIndustryPlaybook({
    companyName: "Sterling Biomedical Services",
    naics: "621999",
  })
  assert.equal(resolution.playbook?.industryId, "biomedical_equipment")
  assert.equal(resolution.playbook?.enrichmentLevel, "reference")
  assert.ok((resolution.playbook?.operationalPains?.length ?? 0) >= 15)

  const legacy = GROWTH_INDUSTRY_SEEDED_PLAYBOOKS.find((row) => row.industryId === "electrical")
  assert.ok(legacy)
  assert.notEqual(legacy!.enrichmentLevel, "reference")
  assert.ok(legacy!.pains.length >= 3)
  console.log("✓ regression — resolver + legacy seed playbooks unchanged")
}

function runAuditCert(): void {
  const matrix = auditIndustryPlaybookMatrix(GROWTH_INDUSTRY_SEEDED_PLAYBOOKS)
  const summary = summarizePlaybookAuditMatrix(matrix)
  assert.equal(summary.reference, 10)
  assert.equal(summary.seed, 17)
  assert.equal(summary.moderate, 0)
  console.log("✓ audit matrix — reference:", summary.reference, "moderate:", summary.moderate, "seed:", summary.seed)
  if (CERT_SECTION === "all" || CERT_SECTION === "audit") {
    for (const row of matrix) {
      console.log(`  ${row.tier.padEnd(10)} ${row.displayName} (pains:${row.pains} discovery:${row.discoveryQuestions})`)
    }
  }
}

function main(): void {
  if (section("schema")) runSchemaCert()
  if (section("enrichment")) runEnrichmentCert()
  if (section("content")) runContentCert()
  if (section("priority")) runPriorityCert()
  if (section("regression")) runRegressionCert()
  if (section("audit")) runAuditCert()

  console.log("\nGS-AI-PLAYBOOK-2A certification passed")
}

main()
