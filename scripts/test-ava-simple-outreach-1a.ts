/**
 * AVA-SIMPLE-OUTREACH-2A — Focused certification.
 * Run: pnpm test:ava-simple-outreach-1a
 */

import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AVA_DIRECT_OUTREACH_MODEL,
  AVA_DIRECT_REASONING_GENERATION_MODE,
  AVA_SIMPLE_OUTREACH_2A_QA_MARKER,
  type AvaDirectOutreachContext,
} from "../lib/growth/ava-direct-outreach/ava-direct-outreach-types"
import {
  enforceDirectOutreachEmailPolicy,
  parseAvaDirectOutreachModelJson,
  runAvaDirectOutreach,
} from "../lib/growth/ava-direct-outreach/ava-direct-outreach-service"
import { normalizeAvaDirectOutreachResult } from "../lib/growth/ava-direct-outreach/ava-direct-outreach-schema"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

function sampleContext(overrides?: Partial<AvaDirectOutreachContext>): AvaDirectOutreachContext {
  return {
    company: {
      name: "Acme Biomedical Service",
      website: "https://acme-biomed.example",
      location: "Austin, TX",
      leadId: "11111111-1111-4111-8111-111111111111",
    },
    decisionMaker: {
      name: "Jordan Lee",
      title: "Director of Operations",
      email: "jordan@acme-biomed.example",
      linkedinUrl: null,
    },
    verifiedCompanyDescription:
      "Acme Biomedical Service repairs and maintains medical imaging equipment on-site.",
    verifiedProductsServices: ["MRI service", "CT preventative maintenance"],
    verifiedOperationalCapabilities: ["On-site technicians", "Multi-vendor imaging service"],
    researchSummary: "Medical equipment service firm with field technicians.",
    relevantWebsiteExcerpts: ["We service MRI and CT systems nationwide."],
    datamoonFindings: [],
    knownRisks: ["Equipify disqualifier guidance: Pure software resellers with no service operations"],
    missingInformation: [],
    equipifyBusinessProfile: {
      name: "Equipify",
      productName: "Equipify",
      productSummary: "Operations platform for equipment service businesses.",
      idealCustomerSummary: "Field service and equipment maintenance companies.",
      approvedCapabilities: ["Work orders", "Equipment records", "Customer portal"],
      approvedValuePropositions: ["Reduce dispatch chaos", "Protect service margins"],
      disqualifiers: ["Pure software resellers with no service operations"],
    },
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log(`[${AVA_SIMPLE_OUTREACH_2A_QA_MARKER}] focused certification`)

  for (const file of [
    "lib/growth/home/growth-home-workspace-summary-service.ts",
    "components/growth/workspace/use-growth-workspace-dashboard.ts",
    "components/growth/workspace/growth-workspace-dashboard-body.tsx",
    "app/(growth)/growth/page.tsx",
    "lib/growth/home/growth-home-canonical-startup-experience-18d.ts",
  ]) {
    assert.doesNotMatch(
      readSource(file),
      /ava-direct-outreach|ava_direct_reasoning_|AVA_SIMPLE_OUTREACH/,
    )
  }

  assert.match(
    readSource("app/api/platform/growth/leads/[leadId]/ava-direct-outreach/route.ts"),
    /requireGrowthEnginePlatformAccess/,
  )
  assert.match(
    readSource("lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts"),
    /outboundAuthorized:\s*false/,
  )
  assert.doesNotMatch(
    readSource("lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts"),
    /sendOutbound|authorizeOutbound|deliverEmail/,
  )
  assert.match(
    readSource("lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts"),
    /insertGrowthAiCopilotGeneration/,
  )
  assert.doesNotMatch(
    readSource("lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts"),
    /updateGrowthAiCopilotGenerationStatus/,
  )
  assert.match(
    readSource("lib/growth/ava-direct-outreach/ava-direct-outreach-types.ts"),
    /gpt-5\.5/,
  )
  assert.match(
    readSource("lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts"),
    /AVA_DIRECT_OUTREACH_MODEL/,
  )
  assert.doesNotMatch(
    readSource("lib/growth/ava-direct-outreach/ava-direct-outreach-service.ts"),
    /gpt-4o-mini/,
  )
  assert.equal(AVA_DIRECT_OUTREACH_MODEL, "gpt-5.5")
  assert.doesNotMatch(
    readSource("lib/growth/ava-direct-outreach/ava-direct-outreach-context-builder.ts"),
    /websiteMaturity|Field Service \(\d+%|equipmentServiceSignals|informationQuality|verifiedFactCount/,
  )

  for (const name of readdirSync(resolve(ROOT, "supabase/migrations"))) {
    if (!name.endsWith(".sql")) continue
    assert.doesNotMatch(
      readFileSync(resolve(ROOT, "supabase/migrations", name), "utf8"),
      /ava_direct_reasoning_|ava-simple-outreach/i,
    )
  }

  const parsed = parseAvaDirectOutreachModelJson({
    decision: "outreach",
    confidence: 0.82,
    fitSummary: "Strong equipment-service fit.",
    supportingReasons: ["On-site equipment service"],
    concerns: ["No confirmed tech count"],
    recommendedContactRole: "Director of Operations",
    salesAngle: "Centralize service history",
    email: {
      subject: "Quick question about Acme's service operations",
      body: "Jordan — short note about Equipify for equipment service teams.",
    },
    evidenceUsed: ["Company services medical imaging equipment on-site"],
    missingInformation: [],
  })
  assert.equal(parsed.decision, "outreach")
  assert.ok(parsed.email?.body)

  assert.equal(
    enforceDirectOutreachEmailPolicy(
      normalizeAvaDirectOutreachResult({
        decision: "reject",
        confidence: 0.9,
        fitSummary: "Outside ICP.",
        supportingReasons: ["No service operations"],
        concerns: [],
        recommendedContactRole: null,
        salesAngle: null,
        email: { subject: "x", body: "y" },
        evidenceUsed: [],
        missingInformation: [],
      }),
    ).email,
    null,
  )

  assert.equal(
    enforceDirectOutreachEmailPolicy(
      normalizeAvaDirectOutreachResult({
        decision: "needs_more_research",
        confidence: 0.3,
        fitSummary: "Thin evidence.",
        supportingReasons: [],
        concerns: ["No website"],
        recommendedContactRole: null,
        salesAngle: null,
        email: { subject: "x", body: "y" },
        evidenceUsed: [],
        missingInformation: ["No research"],
      }),
    ).email,
    null,
  )

  const fakeAdmin = {} as SupabaseClient
  const persistCalls: Array<Record<string, unknown>> = []

  const missing = await runAvaDirectOutreach({
    admin: fakeAdmin,
    leadId: "11111111-1111-4111-8111-111111111111",
    actingUserId: "44444444-4444-4444-8444-444444444444",
    actingUserEmail: "op@test",
    organizationId: "55555555-5555-4555-8555-555555555555",
    persist: false,
    buildContext: async () => ({
      ok: false,
      code: "lead_not_found",
      message: "Lead not found.",
    }),
    runModel: async () => {
      throw new Error("should not run")
    },
  })
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.code, "lead_not_found")

  const noOrg = await runAvaDirectOutreach({
    admin: fakeAdmin,
    leadId: "11111111-1111-4111-8111-111111111111",
    actingUserId: "44444444-4444-4444-8444-444444444444",
    actingUserEmail: "op@test",
    organizationId: "",
    persist: false,
    buildContext: async () => ({
      ok: false,
      code: "organization_unavailable",
      message: "missing org",
    }),
    runModel: async () => {
      throw new Error("should not run")
    },
  })
  assert.equal(noOrg.ok, false)
  if (!noOrg.ok) assert.equal(noOrg.code, "organization_unavailable")

  const sufficient = await runAvaDirectOutreach({
    admin: fakeAdmin,
    leadId: "11111111-1111-4111-8111-111111111111",
    actingUserId: "44444444-4444-4444-8444-444444444444",
    actingUserEmail: "op@test",
    organizationId: "55555555-5555-4555-8555-555555555555",
    persist: true,
    buildContext: async () => ({ ok: true, context: sampleContext() }),
    runModel: async () => ({
      provider: "openai",
      model: AVA_DIRECT_OUTREACH_MODEL,
      result: {
        decision: "outreach",
        confidence: 0.84,
        fitSummary: "Clear ICP fit.",
        supportingReasons: ["Equipment service operations"],
        concerns: [],
        recommendedContactRole: "Director of Operations",
        salesAngle: "Service history clarity",
        email: {
          subject: "Quick question about Acme's service ops",
          body: "Jordan — Equipify note.",
        },
        evidenceUsed: ["Acme Biomedical Service repairs and maintains medical imaging equipment on-site."],
        missingInformation: [],
      },
    }),
    persistDraft: async (input) => {
      persistCalls.push({
        leadId: input.leadId,
        generationMode: AVA_DIRECT_REASONING_GENERATION_MODE,
        decision: input.result.decision,
      })
      assert.equal(input.result.decision, "outreach")
      assert.ok(input.result.email)
      return { id: "33333333-3333-4333-8333-333333333333" }
    },
  })
  assert.equal(sufficient.ok, true)
  if (sufficient.ok) {
    assert.equal(sufficient.output.result.decision, "outreach")
    assert.equal(sufficient.output.outboundAuthorized, false)
    assert.equal(sufficient.output.persistedGenerationId, "33333333-3333-4333-8333-333333333333")
    assert.equal(sufficient.output.generationMode, AVA_DIRECT_REASONING_GENERATION_MODE)
    assert.equal(sufficient.output.qaMarker, AVA_SIMPLE_OUTREACH_2A_QA_MARKER)
  }
  assert.equal(persistCalls.length, 1)

  const poor = await runAvaDirectOutreach({
    admin: fakeAdmin,
    leadId: "11111111-1111-4111-8111-111111111111",
    actingUserId: "44444444-4444-4444-8444-444444444444",
    actingUserEmail: "op@test",
    organizationId: "55555555-5555-4555-8555-555555555555",
    persist: false,
    buildContext: async () => ({
      ok: true,
      context: sampleContext({
        company: {
          name: "Cloud Widgets SaaS",
          website: "https://cloudwidgets.example",
          location: null,
          leadId: "11111111-1111-4111-8111-111111111111",
        },
        verifiedCompanyDescription: "Pure SaaS product company with no service operations.",
        verifiedProductsServices: ["Cloud widget platform"],
        verifiedOperationalCapabilities: [],
        researchSummary: "Pure SaaS product company with no service operations.",
      }),
    }),
    runModel: async () => ({
      provider: "openai",
      model: AVA_DIRECT_OUTREACH_MODEL,
      result: {
        decision: "reject",
        confidence: 0.92,
        fitSummary: "Outside Equipify ICP.",
        supportingReasons: ["No service operations"],
        concerns: ["Disqualifier match"],
        recommendedContactRole: null,
        salesAngle: null,
        email: { subject: "should strip", body: "should strip" },
        evidenceUsed: ["Pure SaaS product company with no service operations."],
        missingInformation: [],
      },
    }),
  })
  assert.equal(poor.ok, true)
  if (poor.ok) {
    assert.equal(poor.output.result.decision, "reject")
    assert.equal(poor.output.result.email, null)
  }

  const thin = await runAvaDirectOutreach({
    admin: fakeAdmin,
    leadId: "11111111-1111-4111-8111-111111111111",
    actingUserId: "44444444-4444-4444-8444-444444444444",
    actingUserEmail: "op@test",
    organizationId: "55555555-5555-4555-8555-555555555555",
    persist: false,
    buildContext: async () => ({
      ok: true,
      context: sampleContext({
        company: {
          name: "Mystery Co",
          website: null,
          location: null,
          leadId: "11111111-1111-4111-8111-111111111111",
        },
        verifiedCompanyDescription: null,
        verifiedProductsServices: [],
        verifiedOperationalCapabilities: [],
        researchSummary: null,
        relevantWebsiteExcerpts: [],
        missingInformation: ["No completed prospect research", "No company website"],
      }),
    }),
    runModel: async ({ userPrompt }) => {
      assert.match(userPrompt, /Mystery Co/)
      assert.match(userPrompt, /No completed prospect research/)
      assert.match(userPrompt, /VERIFIED COMPANY DESCRIPTION/)
      return {
        provider: "openai",
        model: AVA_DIRECT_OUTREACH_MODEL,
        result: {
          decision: "needs_more_research",
          confidence: 0.3,
          fitSummary: "Insufficient evidence.",
          supportingReasons: [],
          concerns: ["No website"],
          recommendedContactRole: null,
          salesAngle: null,
          email: null,
          evidenceUsed: [],
          missingInformation: ["No completed prospect research"],
        },
      }
    },
  })
  assert.equal(thin.ok, true)
  if (thin.ok) {
    assert.equal(thin.output.result.decision, "needs_more_research")
    assert.equal(thin.output.result.email, null)
  }

  console.log(`[${AVA_SIMPLE_OUTREACH_2A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
