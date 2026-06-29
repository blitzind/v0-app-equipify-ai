/**
 * GE-LAUNCH-1B — Unified workflow intake surface wiring certification.
 * Run: pnpm test:growth-unified-workflow-intake-wiring
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildNativeRevenueDecisionStack,
} from "../lib/growth/contact-verification/native-revenue-decision-adapter"
import { buildProspectSearchContactIntelligence } from "../lib/growth/prospect-search/prospect-search-contact-intelligence"
import { normalizeLeadIntakeSource } from "../lib/growth/revenue-workflow/normalize-lead-intake-source"
import {
  resolveAcquisitionContactIntakeSource,
  resolveBrowserIntakeLeadSource,
  workflowResultNeedsReview,
} from "../lib/growth/revenue-workflow/unified-revenue-workflow-intake-mapping"
import { LEAD_INTAKE_SOURCES } from "../lib/growth/revenue-workflow/unified-lead-intake-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertWired(relativePath: string, pattern: RegExp, label: string): void {
  const source = readSource(relativePath)
  assert.match(source, pattern, `${label} missing in ${relativePath}`)
}

async function main(): Promise<void> {
  console.log("\n=== GE-LAUNCH-1B Unified Workflow Intake Wiring Certification ===\n")

  assert.equal(fs.existsSync("lib/growth/revenue-workflow/unified-revenue-workflow-intake-runner.ts"), true)
  console.log("  ✓ Shared intake runner exists")

  const runnerSource = readSource("lib/growth/revenue-workflow/unified-revenue-workflow-intake-runner.ts")
  assert.match(runnerSource, /runUnifiedRevenueWorkflowAfterIntake/)
  assert.match(runnerSource, /resolveBrowserIntakeLeadSource/)
  assert.match(runnerSource, /resolveAcquisitionContactIntakeSource/)
  assert.doesNotMatch(runnerSource, /enrollSequence/i)
  assert.doesNotMatch(runnerSource, /sendEmail/i)
  console.log("  ✓ Intake runner delegates to orchestrator without send/enrollment paths")

  assertWired(
    "app/api/platform/growth/manual-contacts/route.ts",
    /runUnifiedRevenueWorkflowAfterIntake/,
    "manual contact API",
  )
  assertWired("app/api/platform/growth/leads/route.ts", /runUnifiedRevenueWorkflowAfterIntake/, "manual lead API")
  assertWired(
    "lib/growth/browser-intake/create-browser-intake-contact.ts",
    /runUnifiedRevenueWorkflowAfterIntake/,
    "browser intake service",
  )
  assertWired("lib/growth/import/pipeline.ts", /runUnifiedRevenueWorkflowAfterIntake/, "csv import pipeline")
  assertWired(
    "lib/growth/acquisition/promote-verified-contact-to-lead.ts",
    /runUnifiedRevenueWorkflowAfterIntake/,
    "verified contact promotion",
  )
  assertWired(
    "lib/growth/prospect-search/prospect-search-push-to-inbox.ts",
    /runUnifiedRevenueWorkflowAfterIntake/,
    "saved search push",
  )
  console.log("  ✓ All intake surfaces call shared workflow runner")

  assert.equal(resolveBrowserIntakeLeadSource("linkedin"), "linkedin_capture")
  assert.equal(resolveBrowserIntakeLeadSource("website"), "website")
  assert.equal(resolveBrowserIntakeLeadSource("other"), "browser_intake")
  console.log("  ✓ Browser/LinkedIn/website source mapping")

  assert.equal(
    resolveAcquisitionContactIntakeSource({
      metadata: { discovery_provider: "apollo", apollo_person_id: "abc" },
      source_evidence: [],
    }),
    "apollo",
  )
  assert.equal(
    resolveAcquisitionContactIntakeSource({
      metadata: { discovery_provider: "people_data_labs", provider_type: "future_people_data_labs" },
      source_evidence: [],
    }),
    "pdl",
  )
  console.log("  ✓ Apollo/PDL acquisition source mapping")

  const linkedinUncertain = normalizeLeadIntakeSource({
    source: "linkedin_capture",
    company: { name: "LinkedIn Co" },
    contact: { name: "Pat Lee" },
    metadata: { identityUncertain: true },
  })
  assert.equal(linkedinUncertain.requiresHumanReview, true)
  assert.ok(linkedinUncertain.warnings.some((warning) => warning.includes("human_review")))
  console.log("  ✓ Uncertain LinkedIn identity requires human review")

  const missingEmail = normalizeLeadIntakeSource({
    source: "csv_import",
    company: { name: "Acme Corp" },
    contact: { name: "Jane Doe" },
  })
  assert.ok(missingEmail.warnings.some((warning) => warning.includes("missing_email")))
  console.log("  ✓ Missing email produces verification warning")

  const orchestratorSource = readSource("lib/growth/revenue-workflow/unified-revenue-workflow-orchestrator.ts")
  assert.match(orchestratorSource, /loadIreHistoricalLearning/)
  assert.match(orchestratorSource, /buildDailyRevenueWorkQueue/)
  assert.doesNotMatch(orchestratorSource, /enrollSequence/i)
  console.log("  ✓ Orchestrator loads learning + queue without outbound side effects")

  const importSummarySource = readSource("lib/growth/import/types.ts")
  assert.match(importSummarySource, /workflowPrepared/)
  assert.match(importSummarySource, /needsReview/)
  console.log("  ✓ CSV import summary exposes workflowPrepared + needsReview")

  const fixtureIntelligence = buildProspectSearchContactIntelligence({
    company_id: "lead-intake-fixture",
    contacts: [
      {
        id: "person-intake-1",
        full_name: "Chris Taylor",
        title: "VP Operations",
        confidence: 88,
        source_evidence: [{ claim: "Fixture", evidence: "cert", source: "manual" }],
        role_type: "economic_buyer",
        email: "chris.taylor@precisionbiomedical.com",
        verification_status: "verified",
      },
    ],
    committee_completeness: 67,
    schema_ready: true,
    source_labels: ["manual"],
  })

  process.env.GROWTH_NATIVE_DECISION_ENGINE = "true"
  process.env.GROWTH_CONTACT_ACQUISITION = "true"
  process.env.GROWTH_PROSPECT_QUALIFICATION = "true"
  process.env.GROWTH_SEQUENCE_RECOMMENDATION = "true"
  process.env.GROWTH_NEXT_BEST_ACTION = "true"

  const stack = await buildNativeRevenueDecisionStack(
    {
      companyId: "lead-intake-fixture",
      companyName: "Precision Biomedical",
      website: "https://precisionbiomedical.com",
      intelligence: fixtureIntelligence,
      generatedAt: "2026-06-28T00:00:00.000Z",
      historicalLearning: [],
    },
    { skipDns: true },
  )
  assert.ok(stack?.qualification)
  assert.ok(stack?.nextBestAction)
  console.log("  ✓ Workflow result includes IRE stack artifacts")

  assert.equal(
    workflowResultNeedsReview({
      qa_marker: "unified-revenue-workflow-v1",
      source: "manual",
      approvalRequired: true,
      blockers: [],
      warnings: [],
    }),
    true,
  )
  console.log("  ✓ Approval-required workflow flagged for human review")

  for (const source of LEAD_INTAKE_SOURCES) {
    const normalized = normalizeLeadIntakeSource({
      source,
      company: { name: "Precision Biomedical", website: "https://precisionbiomedical.com" },
      contact: { name: "Chris Taylor", email: "chris.taylor@precisionbiomedical.com" },
    })
    assert.equal(normalized.source, source)
  }
  console.log("  ✓ All eight canonical intake sources normalize")

  console.log("\nGE-LAUNCH-1B intake wiring certification PASSED\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
