/**
 * GE-LAUNCH-1A — Unified Lead Intake + Revenue Workflow Orchestrator certification.
 * Run: pnpm test:growth-unified-revenue-workflow
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { GrowthLearningOutcome } from "../lib/growth/aios/learning/growth-closed-loop-learning-types"
import {
  buildNativeRevenueDecisionStack,
} from "../lib/growth/contact-verification/native-revenue-decision-adapter"
import {
  buildEmailLearningObservations,
  type EmailLearningObservation,
} from "../lib/growth/contact-verification/email-learning"
import { buildProspectSearchContactIntelligence } from "../lib/growth/prospect-search/prospect-search-contact-intelligence"
import { GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import {
  mapClosedLoopLearningOutcomesToEmailObservations,
} from "../lib/growth/revenue-workflow/growth-learning-ire-bridge"
import { normalizeLeadIntakeSource } from "../lib/growth/revenue-workflow/normalize-lead-intake-source"
import {
  GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER,
  LEAD_INTAKE_SOURCES,
} from "../lib/growth/revenue-workflow/unified-lead-intake-types"
import { isUnifiedRevenueWorkflowEnabled } from "../lib/growth/revenue-workflow/unified-revenue-workflow-feature"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }) as Promise<T>
}

const FIXTURE_INTELLIGENCE = buildProspectSearchContactIntelligence({
  company_id: "lead-fixture-001",
  contacts: [
    {
      id: "person-001",
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
  source_labels: ["fixture"],
})

assert.equal(FIXTURE_INTELLIGENCE.qa_marker, GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER)

function learningOutcome(input: Partial<GrowthLearningOutcome> & Pick<GrowthLearningOutcome, "outcomeType">): GrowthLearningOutcome {
  return {
    id: input.id ?? `learning-outcome:${input.outcomeType}:1`,
    organizationId: input.organizationId ?? "org-test",
    source: input.source ?? "email",
    outcomeType: input.outcomeType,
    subject: input.subject ?? { type: "lead", id: "lead-fixture-001" },
    related: input.related ?? {},
    signalStrength: input.signalStrength ?? 0.85,
    confidence: input.confidence ?? 0.8,
    dimensions: input.dimensions ?? { channel: "email" },
    evidence: input.evidence ?? [{ source: "cert", label: "email", value: "chris.taylor@precisionbiomedical.com", confidence: 0.9 }],
    occurredAt: input.occurredAt ?? "2026-06-28T12:00:00.000Z",
    createdAt: input.createdAt ?? "2026-06-28T12:00:00.000Z",
  }
}

async function main(): Promise<void> {
  console.log("\n=== GE-LAUNCH-1A Unified Revenue Workflow Certification ===\n")

  assert.equal(GROWTH_UNIFIED_REVENUE_WORKFLOW_QA_MARKER, "unified-revenue-workflow-v1")
  assert.equal(LEAD_INTAKE_SOURCES.length, 9)
  console.log("  ✓ Canonical QA marker + intake sources")

  const orchestratorSource = readSource("lib/growth/revenue-workflow/unified-revenue-workflow-orchestrator.ts")
  assert.match(orchestratorSource, /resolveNativeRevenueDecisionAuthoritativeBundle/)
  assert.match(orchestratorSource, /loadIreHistoricalLearning/)
  assert.match(orchestratorSource, /buildDailyRevenueWorkQueue/)
  assert.doesNotMatch(orchestratorSource, /enrollSequence/i)
  assert.doesNotMatch(orchestratorSource, /sendEmail/i)
  console.log("  ✓ Orchestrator reuses IRE stack + queue without send/enrollment paths")

  const adapterSource = readSource("lib/growth/contact-verification/native-revenue-decision-adapter.ts")
  assert.match(adapterSource, /historicalLearning/)
  console.log("  ✓ Native decision adapter passes historicalLearning into IRE engines")

  const resolverSource = readSource("lib/growth/contact-verification/lead-communication-strategy-resolver.ts")
  assert.match(resolverSource, /loadIreHistoricalLearning/)
  console.log("  ✓ Lead communication strategy resolver loads closed-loop learning")

  assert.equal(fs.existsSync("app/api/platform/growth/revenue-workflow/run/route.ts"), true)
  const apiSource = readSource("app/api/platform/growth/revenue-workflow/run/route.ts")
  assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
  assert.match(apiSource, /runUnifiedRevenueWorkflow/)
  console.log("  ✓ Operator-only API entry exists")

  for (const source of LEAD_INTAKE_SOURCES) {
    const normalized = normalizeLeadIntakeSource({
      source,
      company: { name: "Precision Biomedical", website: "https://precisionbiomedical.com" },
      contact: {
        name: "Chris Taylor",
        title: "VP Operations",
        email: "chris.taylor@precisionbiomedical.com",
      },
    })
    assert.equal(normalized.source, source)
    assert.equal(normalized.companyName, "precision biomedical")
    assert.ok(normalized.domain?.includes("precisionbiomedical.com"))
  }
  console.log("  ✓ All intake sources normalize into canonical shape")

  const missingEmail = normalizeLeadIntakeSource({
    source: "csv_import",
    company: { name: "Acme Corp" },
    contact: { name: "Jane Doe", title: "Director" },
  })
  assert.ok(missingEmail.warnings.some((warning) => warning.includes("missing_email")))
  console.log("  ✓ Missing email routes to verification/research warnings")

  const missingDomain = normalizeLeadIntakeSource({
    source: "manual",
    company: { name: "Acme Corp" },
    contact: { name: "Jane Doe", email: "jane@acme.com" },
  })
  assert.ok(missingDomain.warnings.some((warning) => warning.includes("missing_company_domain")))
  console.log("  ✓ Missing company domain routes to research warnings")

  const linkedinUncertain = normalizeLeadIntakeSource({
    source: "linkedin_capture",
    company: { name: "LinkedIn Co" },
    metadata: { identityUncertain: true },
  })
  assert.equal(linkedinUncertain.requiresHumanReview, true)
  console.log("  ✓ LinkedIn/browser uncertain identity marks human review")

  process.env.GROWTH_LEARNING_IN_MEMORY_STORE = "1"
  const bridged = mapClosedLoopLearningOutcomesToEmailObservations([
    learningOutcome({ outcomeType: "reply", id: "lo-reply-2" }),
    learningOutcome({ outcomeType: "negative_intent", id: "lo-negative-2", source: "call" }),
  ])
  assert.ok(bridged.length >= 2)
  console.log("  ✓ Closed-loop learning outcomes bridge into email learning observations")

  await withEnv(
    {
      GROWTH_UNIFIED_REVENUE_WORKFLOW: "true",
      GROWTH_NATIVE_DECISION_ENGINE: "true",
      GROWTH_CONTACT_ACQUISITION: "true",
      GROWTH_PROSPECT_QUALIFICATION: "true",
      GROWTH_SEQUENCE_RECOMMENDATION: "true",
      GROWTH_NEXT_BEST_ACTION: "true",
      GROWTH_COMMUNICATION_STRATEGY: "true",
      GROWTH_DAILY_REVENUE_WORK_QUEUE: "true",
    },
    async () => {
      assert.equal(isUnifiedRevenueWorkflowEnabled(), true)

      const positiveLearning: EmailLearningObservation[] = buildEmailLearningObservations([
        {
          email: "chris.taylor@precisionbiomedical.com",
          outcome: "positive_reply",
          source: "reply_intelligence",
          eventTimestamp: "2026-06-27T10:00:00.000Z",
        },
        {
          email: "chris.taylor@precisionbiomedical.com",
          outcome: "replied",
          source: "provider_webhook",
          eventTimestamp: "2026-06-27T11:00:00.000Z",
        },
      ])

      const negativeLearning: EmailLearningObservation[] = buildEmailLearningObservations([
        {
          email: "chris.taylor@precisionbiomedical.com",
          outcome: "negative_reply",
          source: "reply_intelligence",
          eventTimestamp: "2026-06-27T10:00:00.000Z",
        },
        {
          email: "chris.taylor@precisionbiomedical.com",
          outcome: "bounce_hard",
          source: "provider_webhook",
          eventTimestamp: "2026-06-27T11:00:00.000Z",
        },
      ])

      const baseline = await buildNativeRevenueDecisionStack(
        {
          companyId: "lead-fixture-001",
          companyName: "Precision Biomedical",
          website: "https://precisionbiomedical.com",
          intelligence: FIXTURE_INTELLIGENCE,
          generatedAt: "2026-06-28T00:00:00.000Z",
          historicalLearning: [],
        },
        { skipDns: true },
      )
      const withPositive = await buildNativeRevenueDecisionStack(
        {
          companyId: "lead-fixture-001",
          companyName: "Precision Biomedical",
          website: "https://precisionbiomedical.com",
          intelligence: FIXTURE_INTELLIGENCE,
          generatedAt: "2026-06-28T00:00:00.000Z",
          historicalLearning: positiveLearning,
        },
        { skipDns: true },
      )
      const withNegative = await buildNativeRevenueDecisionStack(
        {
          companyId: "lead-fixture-001",
          companyName: "Precision Biomedical",
          website: "https://precisionbiomedical.com",
          intelligence: FIXTURE_INTELLIGENCE,
          generatedAt: "2026-06-28T00:00:00.000Z",
          historicalLearning: negativeLearning,
        },
        { skipDns: true },
      )

      assert.ok(baseline)
      assert.ok(withPositive)
      assert.ok(withNegative)
      assert.ok(withPositive.qualification.overallScore >= baseline.qualification.overallScore)
      assert.ok(withNegative.qualification.overallScore <= withPositive.qualification.overallScore)
      console.log("  ✓ Historical learning shifts IRE qualification scores deterministically")
    },
  )

  const dedupeA = normalizeLeadIntakeSource({
    source: "manual",
    company: { name: "Acme" },
    contact: { name: "Jane", email: "jane@acme.com" },
    metadata: { externalRef: "manual:entry:fixed-id" },
  })
  const dedupeB = normalizeLeadIntakeSource({
    source: "manual",
    company: { name: "Acme" },
    contact: { name: "Jane", email: "jane@acme.com" },
    metadata: { externalRef: "manual:entry:fixed-id" },
  })
  assert.equal(dedupeA.externalRef, dedupeB.externalRef)
  assert.deepEqual(dedupeA.importRow, dedupeB.importRow)
  console.log("  ✓ Idempotent intake normalization for duplicate external refs")

  console.log("\nGE-LAUNCH-1A certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
