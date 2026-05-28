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
import {
  GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER,
  GROWTH_LEAD_PIPELINE_IA_QA_MARKER,
} from "../lib/growth/lead-engine/lead-intelligence-inspector-types"
import {
  LEAD_HUMAN_APPROVAL_QA_MARKER,
  LEAD_STAGE_CONFIDENCE_QA_MARKER,
  LEAD_STAGE_EMPTY_STATE_QA_MARKER,
  LEAD_STAGE_EVIDENCE_QA_MARKER,
  LEAD_STAGE_SUMMARY_QA_MARKER,
} from "../lib/growth/lead-engine/lead-intelligence-inspector-qa"
import { LEAD_INTELLIGENCE_INSPECTOR_FIXTURES } from "../lib/growth/lead-engine/lead-intelligence-inspector-fixtures"
import {
  LEAD_ENGINE_ORCHESTRATOR_STAGES,
  runLeadEnginePipeline,
} from "../lib/growth/lead-engine/orchestrator/lead-engine-orchestrator"
import { LEAD_INTELLIGENCE_STAGE_EMPTY_PREVIEWS } from "../lib/growth/lead-engine/lead-intelligence-stage-empty-previews"
import {
  buildLeadIntelligenceStageOperatorSummary,
  resolveLeadIntelligenceStageUxState,
} from "../lib/growth/lead-engine/lead-intelligence-stage-display"
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

const navDefsPath = path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts")
assert.match(fs.readFileSync(navDefsPath, "utf8"), /\/admin\/growth\/leads\/lead-engine/)
assert.match(fs.readFileSync(navDefsPath, "utf8"), /Lead Pipeline/)
assert.match(fs.readFileSync(navDefsPath, "utf8"), /lead intelligence inspector/i)

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
assert.match(workspaceSource, /GROWTH_LEAD_PIPELINE_IA_QA_MARKER/)
assert.match(workspaceSource, /LeadIntelligenceWorkflowCard/)
assert.match(workspaceSource, /LeadIntelligenceExamplePresets/)
assert.match(workspaceSource, /LeadIntelligencePipelineHeader/)
assert.match(workspaceSource, /LeadIntelligenceSystemStatusPanel/)
assert.match(workspaceSource, /LeadIntelligenceOperatorSummaryCard/)
assert.match(workspaceSource, /LeadIntelligenceStagePanel/)
assert.match(workspaceSource, /displayContext/)

const stagePanelPath = path.join(
  process.cwd(),
  "components/growth/lead-intelligence-inspector/lead-intelligence-stage-panel.tsx",
)
const stagePanelSource = fs.readFileSync(stagePanelPath, "utf8")
assert.match(stagePanelSource, /LEAD_STAGE_SUMMARY_QA_MARKER/)
assert.match(stagePanelSource, /LEAD_HUMAN_APPROVAL_QA_MARKER/)
assert.match(stagePanelSource, /LeadIntelligenceEvidencePanel/)
assert.match(stagePanelSource, /LeadIntelligenceStageEmptyState/)

const evidencePanelPath = path.join(
  process.cwd(),
  "components/growth/lead-intelligence-inspector/lead-intelligence-evidence-panel.tsx",
)
assert.match(fs.readFileSync(evidencePanelPath, "utf8"), /LEAD_STAGE_EVIDENCE_QA_MARKER/)

const emptyStatePath = path.join(
  process.cwd(),
  "components/growth/lead-intelligence-inspector/lead-intelligence-stage-empty-state.tsx",
)
assert.match(fs.readFileSync(emptyStatePath, "utf8"), /LEAD_STAGE_EMPTY_STATE_QA_MARKER/)
assert.equal(LEAD_STAGE_SUMMARY_QA_MARKER, "lead-stage-summary-v2")
assert.equal(LEAD_STAGE_EVIDENCE_QA_MARKER, "lead-stage-evidence-v2")
assert.equal(LEAD_STAGE_CONFIDENCE_QA_MARKER, "lead-stage-confidence-v2")
assert.equal(LEAD_STAGE_EMPTY_STATE_QA_MARKER, "lead-stage-empty-state-v2")
assert.equal(LEAD_HUMAN_APPROVAL_QA_MARKER, "lead-human-approval-v2")
assert.doesNotMatch(stagePanelSource, /Stage not run yet/)

const displayLibPath = path.join(
  process.cwd(),
  "lib/growth/lead-engine/lead-intelligence-stage-display.ts",
)
assert.match(fs.readFileSync(displayLibPath, "utf8"), /buildLeadIntelligenceStageOperatorSummary/)
assert.match(fs.readFileSync(displayLibPath, "utf8"), /resolveLeadIntelligenceStageUxState/)

assert.equal(Object.keys(LEAD_INTELLIGENCE_STAGE_EMPTY_PREVIEWS).length, 10)

const icpStage = run.stage_results.find((s) => s.stage_id === "icp_targeting")
assert.ok(icpStage)
const icpSummary = buildLeadIntelligenceStageOperatorSummary(icpStage!)
assert.ok(icpSummary.executiveSummary.length > 0)
assert.ok(icpSummary.keyFindings.length > 0)

const pendingUx = resolveLeadIntelligenceStageUxState(
  { ...icpStage!, status: "pending", parsed: null },
  { hasRun: false, loading: false, runStatus: null, completedStageIds: [], currentStageId: null, isSampleMode: true },
)
assert.equal(pendingUx, "awaiting_input")

assert.doesNotMatch(workspaceSource, /Real-Time Intent Pixel/)
assert.doesNotMatch(workspaceSource, /North Star/)

const pagePath = path.join(process.cwd(), "app/(admin)/admin/growth/leads/lead-engine/page.tsx")
const pageSource = fs.readFileSync(pagePath, "utf8")
assert.match(pageSource, /GROWTH_LEAD_PIPELINE_LABEL/)
assert.match(pageSource, /GROWTH_LEAD_PIPELINE_SUBTITLE/)
assert.match(pageSource, /data-lead-pipeline-ia-marker=\{GROWTH_LEAD_PIPELINE_IA_QA_MARKER\}/)
assert.match(pageSource, /data-qa-marker=\{GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER\}/)
assert.doesNotMatch(pageSource, /lead-engine-workspace-v1/)

assert.equal(GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER, "growth-lead-intelligence-inspector-v2")
assert.equal(GROWTH_LEAD_PIPELINE_IA_QA_MARKER, "growth-lead-pipeline-ia-v1")
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
