/**
 * GE-IRE-6F — Account Outreach Strategy shadow certification.
 * Run: pnpm test:growth-account-outreach-strategy-shadow
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  assertAccountOutreachStrategyShadowLogHasNoSensitiveData,
  buildAccountOutreachStrategyShadow,
  GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW_QA_MARKER,
  isAccountOutreachStrategyShadowEnabled,
  logAccountOutreachStrategyShadow,
  mapProspectSearchContactIntelligenceToShadowInput,
  runAccountOutreachStrategyShadow,
  sanitizeAccountOutreachStrategyPreview,
  shadowLogAccountOutreachStrategyFromProspectSearch,
} from "../lib/growth/contact-verification/account-outreach-strategy-shadow"
import { GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import { recommendAccountOutreach } from "../lib/growth/contact-verification/account-outreach-recommendation"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return fn()
  } finally {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-6F Account Outreach Strategy Shadow Certification ===\n")

  assert.equal(
    GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW_QA_MARKER,
    "account-outreach-strategy-shadow-v1",
  )
  assert.equal(isAccountOutreachStrategyShadowEnabled(), false)
  assert.equal(
    isAccountOutreachStrategyShadowEnabled({ GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW: "true" }),
    true,
  )
  console.log("  ✓ Flag false by default")

  let recommendCalls = 0
  const shadowInput = {
    companyName: "Precision Biomedical",
    domain: "precisionbiomedical.com",
    industry: "healthcare",
    targetUseCase: "service_operations" as const,
    contacts: [
      {
        firstName: "Chris",
        lastName: "Taylor",
        jobTitle: "VP Operations",
        email: "chris.taylor@precisionbiomedical.com",
        phone: "+1-555-0100",
        linkedinUrl: "https://linkedin.com/in/chris-taylor",
      },
      {
        firstName: "Pat",
        lastName: "Reed",
        jobTitle: "Procurement Manager",
        email: "pat.reed@precisionbiomedical.com",
      },
    ],
    context: { surface: "certification" },
  }

  await withEnv({ GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW: undefined }, async () => {
    const noop = await runAccountOutreachStrategyShadow(shadowInput, {
      recommendAccountOutreach: async () => {
        recommendCalls += 1
        throw new Error("should not run")
      },
    })
    assert.equal(noop, null)
  })
  assert.equal(recommendCalls, 0)
  console.log("  ✓ Flag false no-op")

  const entry = await buildAccountOutreachStrategyShadow(shadowInput, { skipDns: true })
  assert.ok(entry)
  assert.equal(entry.qa_marker, GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW_QA_MARKER)
  assert.equal(entry.shadow, "account_outreach_strategy")
  assert.equal(entry.company_present, true)
  assert.equal(entry.domain_present, true)
  assert.ok(entry.total_contacts >= 2)
  assert.ok(entry.primary_contact_present)
  assert.ok(entry.primary_role)
  assert.ok(entry.recommended_channel)
  assert.ok(entry.staged_plan_steps >= 1)
  assert.ok(assertAccountOutreachStrategyShadowLogHasNoSensitiveData(entry))
  console.log("  ✓ Flag true builds sanitized recommendation")

  const fullResult = await recommendAccountOutreach(shadowInput, { skipDns: true })
  const sanitized = sanitizeAccountOutreachStrategyPreview(fullResult, { surface: "certification" })
  assert.ok(assertAccountOutreachStrategyShadowLogHasNoSensitiveData(sanitized))
  assert.equal(sanitized.committee_coverage_score, Math.round(fullResult.summary.committee_coverage_score * 100))
  console.log("  ✓ sanitizeAccountOutreachStrategyPreview privacy")

  const missingContext = await buildAccountOutreachStrategyShadow(
    { companyName: "Empty", contacts: [] },
    { skipDns: true },
  )
  assert.equal(missingContext, null)

  const whitespaceOnly = await buildAccountOutreachStrategyShadow(
    {
      companyName: "Whitespace",
      contacts: [{ fullName: "   " }],
    },
    { skipDns: true },
  )
  assert.ok(whitespaceOnly)
  console.log("  ✓ No throw on sparse contact context")

  const mapped = mapProspectSearchContactIntelligenceToShadowInput({
    companyName: "Acme",
    website: "https://www.acme.com",
    intelligence: {
      qa_marker: GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER,
      schema_ready: true,
      has_contacts: true,
      contacts: [
        {
          id: "c1",
          name: "Jane Doe",
          title: "COO",
          confidence: 0.8,
          source_evidence: [],
          role_type: "operational_buyer",
          recommended_priority: 1,
          email: "jane.doe@acme.com",
          phone: "+1-555-9999",
          linkedin_url: "https://linkedin.com/in/jane-doe",
        },
      ],
      committee_roles: [],
      committee_completeness_pct: null,
      first_contact: null,
      confidence_explanation: null,
      outreach_recommendation: null,
      source_labels: [],
      empty_reason: null,
    },
  })
  assert.ok(mapped)
  assert.equal(mapped?.domain, "acme.com")
  assert.equal(mapped?.contacts.length, 1)
  console.log("  ✓ Prospect search contact mapping")

  let logged = false
  const originalInfo = console.info
  console.info = (message?: unknown) => {
    if (typeof message === "string" && message.includes("account_outreach_strategy")) {
      logged = true
      const parsed = JSON.parse(message)
      assert.ok(assertAccountOutreachStrategyShadowLogHasNoSensitiveData(parsed))
    }
  }
  try {
    logAccountOutreachStrategyShadow(entry!)
  } finally {
    console.info = originalInfo
  }
  assert.equal(logged, true)
  console.log("  ✓ logAccountOutreachStrategyShadow JSON only")

  await withEnv({ GROWTH_ACCOUNT_OUTREACH_STRATEGY_SHADOW: "true" }, async () => {
    shadowLogAccountOutreachStrategyFromProspectSearch({
      companyName: "Acme",
      website: "acme.com",
      intelligence: {
        qa_marker: GROWTH_PROSPECT_SEARCH_CONTACT_INTELLIGENCE_QA_MARKER,
        schema_ready: true,
        has_contacts: true,
        contacts: [
          {
            id: "c1",
            name: "Jane Doe",
            title: "COO",
            confidence: 0.8,
            source_evidence: [],
            role_type: "operational_buyer",
            recommended_priority: 1,
            email: "jane.doe@acme.com",
          },
        ],
        committee_roles: [],
        committee_completeness_pct: null,
        first_contact: null,
        confidence_explanation: null,
        outreach_recommendation: null,
        source_labels: [],
        empty_reason: null,
      },
      context: { surface: "prospect_search_contact_intelligence_loader" },
    })

    await new Promise((resolve) => setTimeout(resolve, 250))
  })
  console.log("  ✓ Prospect search shadow wiring helper fire-and-forget")

  const loaderSource = readSource("lib/growth/prospect-search/prospect-search-contact-intelligence-loader.ts")
  assert.ok(loaderSource.includes("shadowLogAccountOutreachStrategyFromProspectSearch"))
  assert.ok(!loaderSource.includes("account_outreach_strategy:"))
  assert.ok(!loaderSource.includes("primary_recommendation:"))
  console.log("  ✓ Wired surface logging only — no API shape fields added")

  const shadowSource = readSource("lib/growth/contact-verification/account-outreach-strategy-shadow.ts")
  assert.ok(!shadowSource.includes("supabase"))
  assert.ok(!shadowSource.includes("enrollContact"))
  assert.ok(!shadowSource.includes("sendMessage"))
  assert.ok(!/\bfrom\s+["']@\/lib\/.*provider/.test(shadowSource))
  console.log("  ✓ No DB, provider, enrollment, or send imports")

  const verificationService = readSource("lib/growth/contact-verification/email-verification-service.ts")
  assert.ok(!verificationService.includes("account-outreach-strategy-shadow"))
  console.log("  ✓ Not wired to production verification service")

  const cliOutput = execSync(
    "tsx scripts/account-outreach-recommendation-preview.ts --fixture --shadow-log",
    { cwd: process.cwd(), encoding: "utf8" },
  )
  const jsonLine = cliOutput.trim().split("\n").find((line) => line.startsWith("{"))
  assert.ok(jsonLine)
  const cliJson = JSON.parse(jsonLine) as { preview: unknown; shadow_log: unknown }
  assert.ok(cliJson.preview)
  assert.ok(cliJson.shadow_log)
  assert.ok(assertAccountOutreachStrategyShadowLogHasNoSensitiveData(cliJson))
  console.log("  ✓ Preview CLI --shadow-log option")

  const repeat = await buildAccountOutreachStrategyShadow(shadowInput, { skipDns: true })
  assert.deepEqual(repeat, entry)
  console.log("  ✓ Deterministic shadow output")

  console.log("\nGE-IRE-6F account outreach strategy shadow certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
