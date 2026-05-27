/**
 * Regression checks for Lead Engine workspace + orchestrator (Prompt 11).
 * Run: pnpm test:growth-lead-engine-workspace
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  LEAD_ENGINE_STAGE_UI,
  GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER,
} from "../lib/growth/lead-engine/lead-engine-stage-ui"
import { GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER } from "../lib/growth/lead-engine/lead-intelligence-inspector-types"
import { LEAD_INTELLIGENCE_INSPECTOR_FIXTURES } from "../lib/growth/lead-engine/lead-intelligence-inspector-fixtures"
import {
  LEAD_ENGINE_ORCHESTRATOR_STAGES,
  runLeadEnginePipeline,
} from "../lib/growth/lead-engine/orchestrator/lead-engine-orchestrator"
import { GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER } from "../lib/growth/lead-engine/orchestrator/lead-engine-run-types"

assert.equal(GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER, "lead-engine-workspace-v1")
assert.equal(GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER, "lead-engine-workspace-v1")
assert.equal(LEAD_ENGINE_STAGE_UI.length, 10)
assert.equal(LEAD_ENGINE_ORCHESTRATOR_STAGES.length, 10)

const run = runLeadEnginePipeline({
  companyName: "Precision Biomedical Services",
  domain: "precisionbiomed.example",
  industry: "Biomedical field service",
  location: "United States",
  notes: "Dispatch coordination context",
})

assert.ok(run.run_id.length > 0)
assert.equal(run.pipeline_status, "completed")
assert.equal(run.completed_stages.length, 10)
assert.equal(run.fatal_errors.length, 0)
assert.ok(run.execution_duration_ms >= 0)
assert.ok(run.pipeline_attribution_chain.length > 0)
assert.ok(run.pipeline_evidence_chain.length > 0)
assert.equal(run.stage_results.length, 10)

const execution = run.stage_results.find((s) => s.stage_id === "revenue_execution")
assert.equal(execution?.status, "completed")
assert.equal(execution?.parse_ok, true)

const rejectRun = runLeadEnginePipeline({
  companyName: "Bad Co",
  domain: "bad.example",
  industry: "Test",
  location: "US",
  notes: "test",
})

assert.ok(rejectRun.completed_stages.includes("verification_triage"))

const navPath = path.join(process.cwd(), "components/growth/growth-section-sidebar-nav.tsx")
assert.match(fs.readFileSync(navPath, "utf8"), /\/admin\/growth\/leads\/lead-engine/)

const orchestratorPath = path.join(
  process.cwd(),
  "lib/growth/lead-engine/orchestrator/lead-engine-orchestrator.ts",
)
assert.match(fs.readFileSync(orchestratorPath, "utf8"), /runLeadEnginePipeline/)
assert.match(fs.readFileSync(orchestratorPath, "utf8"), /import "server-only"/)

const workspaceComponentPath = path.join(
  process.cwd(),
  "components/growth/growth-lead-engine-workspace.tsx",
)
const workspaceSource = fs.readFileSync(workspaceComponentPath, "utf8")
assert.doesNotMatch(workspaceSource, /lead-engine-orchestrator/)
assert.match(workspaceSource, /lead-engine-stage-ui/)
assert.match(workspaceSource, /\/api\/platform\/growth\/lead-engine\/sandbox/)
assert.match(workspaceSource, /GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER/)
assert.match(workspaceSource, /LeadIntelligenceWorkflowCard/)
assert.match(workspaceSource, /LeadIntelligenceExamplePresets/)
assert.match(workspaceSource, /LeadIntelligencePipelineHeader/)
assert.match(workspaceSource, /LeadIntelligenceSystemStatusPanel/)
assert.doesNotMatch(workspaceSource, /Real-Time Intent Pixel/)
assert.doesNotMatch(workspaceSource, /North Star/)

const pagePath = path.join(process.cwd(), "app/(admin)/admin/growth/leads/lead-engine/page.tsx")
const pageSource = fs.readFileSync(pagePath, "utf8")
assert.match(pageSource, /Lead Intelligence Inspector/)
assert.match(pageSource, /GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER/)
assert.doesNotMatch(pageSource, /Lead Engine Tools/)

assert.equal(GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER, "growth-lead-intelligence-inspector-v2")
assert.equal(LEAD_INTELLIGENCE_INSPECTOR_FIXTURES.length, 4)
assert.ok(LEAD_INTELLIGENCE_INSPECTOR_FIXTURES.some((f) => f.label === "Medical Equipment"))
assert.ok(LEAD_INTELLIGENCE_INSPECTOR_FIXTURES.some((f) => f.label === "HVAC"))
assert.ok(LEAD_INTELLIGENCE_INSPECTOR_FIXTURES.some((f) => f.label === "Garage Door"))
assert.ok(LEAD_INTELLIGENCE_INSPECTOR_FIXTURES.some((f) => f.label === "Field Service"))

const operatorWorkspacePath = path.join(
  process.cwd(),
  "components/growth/lead-operator/growth-lead-operator-workspace.tsx",
)
const operatorSource = fs.readFileSync(operatorWorkspacePath, "utf8")
assert.doesNotMatch(operatorSource, /lead-engine-orchestrator/)
assert.match(operatorSource, /lead-engine-stage-ui/)

const sandboxRoutePath = path.join(
  process.cwd(),
  "app/api/platform/growth/lead-engine/sandbox/route.ts",
)
assert.match(fs.readFileSync(sandboxRoutePath, "utf8"), /runLeadEnginePipeline/)

console.log("lead-engine-workspace.test.ts: all checks passed")
