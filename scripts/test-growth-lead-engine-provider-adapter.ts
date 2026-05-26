/**
 * Regression checks for Lead Engine provider adapter layer (Prompt 14).
 * Run: pnpm test:growth-lead-engine-provider-adapter
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { runLeadEnginePipeline } from "../lib/growth/lead-engine/orchestrator/lead-engine-orchestrator"
import {
  fetchLeadEngineStageProviderResultsSync,
  resolveLeadEngineProviderBundle,
} from "../lib/growth/lead-engine/providers/provider-registry"
import {
  buildFixtureIcpNormalizedPayload,
  fixtureCompanyResearchSync,
  invokeFixtureProviderSync,
} from "../lib/growth/lead-engine/providers/fixture-provider"
import { createInternalGrowthLeadEngineProviderBundle } from "../lib/growth/lead-engine/providers/internal-growth-provider"
import {
  GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER,
  toPublicProviderResponse,
} from "../lib/growth/lead-engine/providers/provider-types"
import { providerFailureResponse, runProviderIsolated } from "../lib/growth/lead-engine/providers/provider-errors"

async function main(): Promise<void> {
  assert.equal(GROWTH_LEAD_ENGINE_PROVIDER_ADAPTER_QA_MARKER, "lead-engine-provider-adapter-v1")

  const orchestratorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/lead-engine/orchestrator/lead-engine-orchestrator.ts"),
    "utf8",
  )
  assert.match(orchestratorSource, /fetchLeadEngineStageProviderResultsSync/)
  assert.match(orchestratorSource, /provider_mode/)
  assert.match(orchestratorSource, /buildRawJson/)

  const input = {
    companyName: "Precision Biomedical Services",
    domain: "precisionbiomed.example",
    industry: "Biomedical field service",
    location: "United States",
    notes: "Dispatch coordination context",
  }

  const icpPayload = buildFixtureIcpNormalizedPayload(input)
  const companyResponse = fixtureCompanyResearchSync({
    input,
    stage_id: "company_discovery",
    query: { company_name: input.companyName, domain: input.domain },
    upstream: { icp: icpPayload },
  })

  assert.equal(companyResponse.provider_name, "lead_engine_fixture_provider")
  assert.equal(companyResponse.status, "success")
  assert.ok(companyResponse.source_attribution.length > 0)
  assert.ok(companyResponse.raw_payload != null)
  assert.ok(companyResponse.normalized_payload != null)

  const publicView = toPublicProviderResponse(companyResponse)
  assert.equal(publicView.raw_payload_retained, true)
  assert.equal("raw_payload" in publicView, false)

  const internalBundle = createInternalGrowthLeadEngineProviderBundle(null)
  const internalContext = {
    input,
    stage_id: "company_discovery" as const,
    query: { company_name: input.companyName, domain: input.domain },
  }
  const internalResult = await internalBundle.company_research.research(internalContext)
  assert.ok(["skipped", "partial", "failed"].includes(internalResult.status))
  assert.ok(internalResult.source_attribution.length > 0)

  const isolated = await runProviderIsolated(
    "test_provider",
    "company_research",
    internalContext,
    "req-fail",
    async () => {
      throw new Error("simulated provider outage")
    },
  )
  assert.equal(isolated.status, "failed")
  assert.ok(isolated.source_attribution.length > 0)
  assert.ok(isolated.errors.length > 0)

  const failure = providerFailureResponse(
    "test",
    "verification",
    { ...internalContext, stage_id: "verification_triage" },
    "req-2",
    new Error("boom"),
  )
  assert.equal(failure.status, "failed")
  assert.ok(failure.source_attribution.length > 0)

  const bundle = fetchLeadEngineStageProviderResultsSync("fixture", input, "company_discovery", {
    icp: icpPayload,
  })
  assert.equal(bundle.qa_marker, "lead-engine-provider-adapter-v1")
  assert.ok(bundle.responses.length > 0)
  for (const response of bundle.responses) {
    assert.ok(response.source_attribution.length > 0, `missing attribution for ${response.provider_type}`)
  }

  const future = fetchLeadEngineStageProviderResultsSync("future_external", input, "contact_research", {})
  assert.ok(future.responses.every((r) => r.status === "skipped"))

  const defaultRun = runLeadEnginePipeline(input)
  assert.equal(defaultRun.pipeline_status, "completed")
  assert.equal(defaultRun.provider_mode, null)
  assert.equal(defaultRun.provider_adapter_qa_marker, null)

  const providerRun = runLeadEnginePipeline(input, { providerMode: "fixture" })
  assert.equal(providerRun.pipeline_status, "completed")
  assert.equal(providerRun.provider_mode, "fixture")
  assert.ok(providerRun.stage_results.some((s) => (s.provider_results?.length ?? 0) > 0))

  const websiteOnly = invokeFixtureProviderSync("website_research", {
    input,
    stage_id: "icp_targeting",
    query: { domain: "example.com" },
  })
  assert.ok(websiteOnly.source_attribution.length > 0)

  const fixtureBundle = resolveLeadEngineProviderBundle("fixture")
  assert.equal(fixtureBundle.mode, "fixture")

  console.log("lead-engine-provider-adapter-v1 checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
