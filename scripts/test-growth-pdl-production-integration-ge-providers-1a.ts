/**
 * GE-PROVIDERS-1A — PDL production integration certification.
 * Run: pnpm test:growth-pdl-production-integration-ge-providers-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

export const GROWTH_PDL_PRODUCTION_INTEGRATION_GE_PROVIDERS_1A_QA_MARKER =
  "growth-pdl-production-integration-ge-providers-1a-v1" as const

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const keys = new Set([...Object.keys(env), ...Object.keys(process.env)])
  const prior = new Map<string, string | undefined>()
  for (const key of keys) {
    prior.set(key, process.env[key])
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return fn()
  } finally {
    for (const [key, value] of prior.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function main() {
  const [
    pdlConfig,
    pdlDiagnostics,
    pdlGuardrails,
    pdlFusion,
    operatorProviders,
    readiness,
    budgetGuards,
  ] = await Promise.all([
    import("../lib/growth/providers/pdl/pdl-config"),
    import("../lib/growth/providers/pdl/pdl-config-diagnostics"),
    import("../lib/growth/providers/pdl/pdl-run-guardrails"),
    import("../lib/growth/providers/pdl/pdl-provider-fusion"),
    import("../lib/growth/contact-discovery/contact-discovery-operator-providers"),
    import("../lib/growth/prospect-discovery/prospect-execution-readiness"),
    import("../lib/growth/prospect-discovery/prospect-execution-budget-guards"),
  ])

  const checks: string[] = []

  // Feature flags mirror Apollo
  withEnv(
    {
      PEOPLE_DATA_LABS_API_KEY: "test-key",
      GROWTH_CONTACT_DISCOVERY_PDL_ENABLED: undefined,
    },
    () => {
      assert.equal(pdlConfig.isPdlProviderConfigured(), false)
      checks.push("master_enable_required")
    },
  )

  withEnv(
    {
      PEOPLE_DATA_LABS_API_KEY: "test-key",
      GROWTH_CONTACT_DISCOVERY_PDL_ENABLED: "true",
      PDL_USE_SANDBOX: undefined,
    },
    () => {
      assert.equal(pdlConfig.isPdlProviderConfigured(), true)
      assert.equal(pdlConfig.isPdlSandboxEnabled(), false, "sandbox defaults off")
      checks.push("production_first_sandbox_default")
    },
  )

  withEnv(
    {
      GROWTH_PDL_USE_MOCK: "true",
      GROWTH_CONTACT_DISCOVERY_PDL_ENABLED: "true",
    },
    () => {
      assert.equal(pdlConfig.isPdlProviderConfigured(), true)
      checks.push("mock_mode_supported")
    },
  )

  // Config diagnostics
  const diag = pdlDiagnostics.diagnosePdlContactDiscoveryConfig({
    PEOPLE_DATA_LABS_API_KEY: "k",
    GROWTH_CONTACT_DISCOVERY_PDL_ENABLED: "true",
  } as NodeJS.ProcessEnv)
  assert.equal(diag.ready_for_live_search, true)
  checks.push("config_diagnostics_live_search")

  // Run guardrails
  pdlGuardrails.beginPdlRunGuardrails()
  pdlGuardrails.recordPdlLookup()
  const snap = pdlGuardrails.getPdlRunGuardrailSnapshot()
  assert.equal(snap?.lookups, 1)
  pdlGuardrails.resetPdlRunGuardrails()
  checks.push("run_guardrails_lookup_counter")

  assert.throws(() => {
    pdlGuardrails.beginPdlRunGuardrails()
    for (let i = 0; i < 50; i += 1) pdlGuardrails.recordPdlLookup()
  })
  pdlGuardrails.resetPdlRunGuardrails()
  checks.push("run_guardrails_budget_enforcement")

  // Budget guard wiring
  const budgetCtx = budgetGuards.createProspectExecutionBudgetContext(
    {
      estimated_companies: 10,
      estimated_contacts: 20,
      estimated_credits: 10,
      estimated_runtime_seconds: 120,
      cost_breakdown: { pdl_lookup_units: 5, apollo_credit_units: 10 },
    } as never,
    { certification_mode: true },
  )
  budgetCtx.pdl_lookups_consumed = budgetCtx.max_pdl_lookups
  const guard = budgetGuards.evaluateProspectExecutionBudgetGuard(budgetCtx)
  assert.equal(guard.action, "pause")
  checks.push("prospect_budget_pdl_cap")

  // Operator chain opt-in
  withEnv(
    { GROWTH_CONTACT_DISCOVERY_PDL_ENABLED: undefined, PEOPLE_DATA_LABS_API_KEY: "k" },
    () => {
      const chain = operatorProviders.resolveOperatorContactDiscoveryProviderTypes(process.env)
      assert.ok(!chain.includes("future_people_data_labs"))
      checks.push("operator_chain_pdl_opt_in")
    },
  )

  withEnv(
    {
      GROWTH_CONTACT_DISCOVERY_PDL_ENABLED: "true",
      PEOPLE_DATA_LABS_API_KEY: "k",
    },
    () => {
      const chain = operatorProviders.resolveOperatorContactDiscoveryProviderTypes(process.env)
      assert.ok(chain.includes("future_people_data_labs"))
      checks.push("operator_chain_pdl_when_enabled")
    },
  )

  // Provider fusion
  const fusion = pdlFusion.resolveProductionProviderFusionPlan({
    channel: "contact_discovery",
    apollo_available: true,
    pdl_available: true,
  })
  assert.ok(fusion.order.some((step) => step.provider === "pdl"))
  assert.ok(fusion.order.some((step) => step.provider === "apollo"))
  checks.push("provider_fusion_order")

  // Readiness env snapshot
  const envSnap = readiness.resolveProspectProviderEnvSnapshot({
    PEOPLE_DATA_LABS_API_KEY: "k",
    GROWTH_CONTACT_DISCOVERY_PDL_ENABLED: "true",
  })
  assert.equal(envSnap.pdl_enabled, true)
  checks.push("readiness_pdl_enabled_flag")

  // Source files present
  const requiredFiles = [
    "lib/growth/providers/pdl/pdl-run-guardrails.ts",
    "lib/growth/providers/pdl/pdl-config-diagnostics.ts",
    "lib/growth/providers/pdl/pdl-http.ts",
    "lib/growth/providers/pdl/pdl-company-mapper.ts",
    "lib/growth/providers/pdl/pdl-company-intelligence-source.ts",
    "lib/growth/providers/pdl/pdl-provider-fusion.ts",
  ]
  for (const file of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} missing`)
  }
  checks.push("required_files_present")

  // Client exports enrich APIs
  const clientSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/pdl/pdl-client.ts"),
    "utf8",
  )
  assert.match(clientSource, /export async function enrichPdlPerson/)
  assert.match(clientSource, /export async function enrichPdlCompany/)
  assert.match(clientSource, /fetchPdlJson/)
  checks.push("person_and_company_enrich_apis")

  // Company intelligence wired
  const ciSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/company-intelligence/company-intelligence-sources.ts"),
    "utf8",
  )
  assert.match(ciSource, /collectPdlCompanyIntelligenceFindings/)
  checks.push("company_intelligence_integration")

  // Stage executor wires PDL guardrails
  const stageSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-discovery/prospect-stage-executor.ts"),
    "utf8",
  )
  assert.match(stageSource, /beginPdlRunGuardrails/)
  assert.match(stageSource, /pdl_lookups_consumed/)
  checks.push("stage_executor_pdl_guardrails")

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PDL_PRODUCTION_INTEGRATION_GE_PROVIDERS_1A_QA_MARKER,
        certification: "PASS",
        checks_passed: checks.length,
        checks,
        credit_limits: pdlConfig.resolvePdlCreditLimits(),
        fusion_summary: fusion.summary,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
