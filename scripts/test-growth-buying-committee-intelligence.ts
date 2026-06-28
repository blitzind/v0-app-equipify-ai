/**
 * GE-IRE-6C — Buying Committee Intelligence certification.
 * Run: pnpm test:growth-buying-committee-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  analyzeBuyingCommittee,
  buildBuyingCommitteeStrategy,
  BUYING_COMMITTEE_ROLES,
  classifyBuyingCommitteeRoles,
  computeBuyingCommitteeCoverage,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER,
} from "../lib/growth/contact-verification/buying-committee-intelligence"
import { buildCompanyPatternEvidenceFromCounts } from "../lib/growth/contact-verification/identity-resolution-engine"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-6C Buying Committee Intelligence Certification ===\n")

  assert.equal(GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER, "buying-committee-intelligence-v1")
  assert.equal(BUYING_COMMITTEE_ROLES.length, 9)
  console.log("  ✓ Role taxonomy")

  const multiRole = classifyBuyingCommitteeRoles({
    contact: { jobTitle: "CEO", department: "Executive" },
  })
  assert.ok(multiRole.roles.some((row) => row.role === "economic_buyer"))
  assert.ok(multiRole.roles.some((row) => row.role === "executive_sponsor"))
  assert.equal(multiRole.primary_role, "economic_buyer")
  console.log("  ✓ Role classification and multiple roles per contact")

  const opsRole = classifyBuyingCommitteeRoles({
    contact: { jobTitle: "Director of Operations", department: "operations" },
  })
  assert.equal(opsRole.primary_role, "operational_buyer")
  console.log("  ✓ Primary role selection")

  const serviceCoverage = computeBuyingCommitteeCoverage({
    useCase: "service_operations",
    coveredRoles: new Set(["operational_buyer", "champion", "technical_evaluator"]),
  })
  assert.ok(serviceCoverage.required_roles.includes("operational_buyer"))
  assert.ok(serviceCoverage.missing_roles.includes("economic_buyer"))
  assert.equal(serviceCoverage.coverage_tier, "moderate")
  console.log("  ✓ Use-case-specific required roles and coverage tier")

  const growthCoverage = computeBuyingCommitteeCoverage({
    useCase: "growth_engine",
    coveredRoles: new Set([
      "economic_buyer",
      "operational_buyer",
      "executive_sponsor",
      "champion",
      "finance_procurement",
    ]),
  })
  assert.equal(growthCoverage.coverage_score, 1)
  assert.equal(growthCoverage.coverage_tier, "strong")
  console.log("  ✓ Committee coverage score")

  const companyEvidence = buildCompanyPatternEvidenceFromCounts({
    domain: "precisionbiomedical.com",
    pattern_counts: { first_dot_last: 30 },
  })

  const result = await analyzeBuyingCommittee(
    {
      companyName: "Precision Biomedical",
      domain: "precisionbiomedical.com",
      industry: "healthcare",
      targetUseCase: "service_operations",
      companyPatternEvidence: companyEvidence,
      contacts: [
        {
          firstName: "Chris",
          lastName: "Taylor",
          jobTitle: "VP Operations",
          department: "operations",
          email: "chris.taylor@precisionbiomedical.com",
        },
        {
          firstName: "John",
          lastName: "Smith",
          jobTitle: "Director of Operations",
          department: "operations",
        },
        {
          firstName: "Amy",
          lastName: "Lee",
          jobTitle: "Biomedical Engineer",
          department: "engineering",
        },
        {
          firstName: "Pat",
          lastName: "Reed",
          jobTitle: "Procurement Manager",
          department: "finance",
        },
      ],
    },
    { skipDns: true },
  )

  assert.equal(result.qa_marker, GROWTH_BUYING_COMMITTEE_INTELLIGENCE_QA_MARKER)
  assert.equal(result.summary.total_contacts, 4)
  assert.ok(result.summary.classified_contacts >= 3)
  assert.ok(result.roles.operational_buyer.contacts.length >= 2)
  assert.ok(result.recommendation.primary_contact)
  assert.ok(result.recommendation.primary_role)
  assert.ok(result.recommendation.backup_contacts.length >= 1)
  assert.ok(result.recommendation.reasons.length >= 2)
  assert.ok(result.coverage.missing_roles.includes("economic_buyer"))
  assert.ok(result.recommendation.warnings.some((w) => w.includes("economic buyer")))
  console.log("  ✓ Primary outreach recommendation, backup contacts, missing role warnings")

  assert.ok(result.recommendation.recommended_strategy.length > 0)
  assert.ok(result.summary.recommendation.includes("Primary recommendation"))
  console.log("  ✓ Explanation output")

  const repeat = await analyzeBuyingCommittee(
    {
      companyName: "Precision Biomedical",
      domain: "precisionbiomedical.com",
      industry: "healthcare",
      targetUseCase: "service_operations",
      companyPatternEvidence: companyEvidence,
      contacts: [
        {
          firstName: "Chris",
          lastName: "Taylor",
          jobTitle: "VP Operations",
          department: "operations",
          email: "chris.taylor@precisionbiomedical.com",
        },
        {
          firstName: "John",
          lastName: "Smith",
          jobTitle: "Director of Operations",
          department: "operations",
        },
        {
          firstName: "Amy",
          lastName: "Lee",
          jobTitle: "Biomedical Engineer",
          department: "engineering",
        },
        {
          firstName: "Pat",
          lastName: "Reed",
          jobTitle: "Procurement Manager",
          department: "finance",
        },
      ],
    },
    { skipDns: true },
  )

  assert.deepEqual(
    result.recommendation.primary_contact?.contact.display_name,
    repeat.recommendation.primary_contact?.contact.display_name,
  )
  assert.deepEqual(result.coverage, repeat.coverage)
  console.log("  ✓ Deterministic ordering and CRE integration")

  const strategy = buildBuyingCommitteeStrategy({
    primaryRole: "operational_buyer",
    coverage: serviceCoverage,
    useCase: "service_operations",
  })
  assert.ok(strategy.includes("operational buyer"))
  console.log("  ✓ Recommended strategy")

  const engineSource = readSource("lib/growth/contact-verification/buying-committee-intelligence.ts")
  assert.doesNotMatch(engineSource, /zerobounce|createClient|from "@supabase/)
  assert.doesNotMatch(engineSource, /from ["']openai/)

  const creSource = readSource("lib/growth/contact-verification/contact-recommendation-engine.ts")
  assert.doesNotMatch(creSource, /buying-committee-intelligence/)
  console.log("  ✓ No external provider imports or production wiring")

  console.log("\nGE-IRE-6C buying committee intelligence certification passed.\n")
  console.log(
    `Primary: ${result.recommendation.primary_contact?.contact.display_name} (${result.recommendation.primary_role?.replace(/_/g, " ")})`,
  )
  console.log(`Coverage: ${result.coverage.coverage_tier} (${Math.round(result.coverage.coverage_score * 100)}%)`)
  console.log(`Strategy: ${result.recommendation.recommended_strategy}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
