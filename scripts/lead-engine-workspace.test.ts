/**
 * Regression checks for Lead Engine workspace (UI shell + sandbox pipeline).
 * Run: pnpm test:growth-lead-engine-workspace
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { runGrowthLeadEngineSandboxPipeline } from "../lib/growth/lead-engine/run-sandbox-pipeline"
import { GROWTH_LEAD_ENGINE_PIPELINE_STAGES } from "../lib/growth/lead-engine/run-sandbox-pipeline"
import { GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER } from "../lib/growth/lead-engine/workspace-types"

assert.equal(GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER, "lead-engine-workspace-v1")
assert.equal(GROWTH_LEAD_ENGINE_PIPELINE_STAGES.length, 10)

const result = runGrowthLeadEngineSandboxPipeline({
  companyName: "Precision Biomedical Services",
  domain: "precisionbiomed.example",
  industry: "Biomedical field service",
  location: "United States",
  notes: "Dispatch coordination context",
})

assert.equal(result.qaMarker, "lead-engine-workspace-v1")
assert.equal(result.mode, "fixture_dry_run")
assert.equal(result.stages.length, 10)
assert.equal(result.completedCount, 10)
assert.equal(result.errorCount, 0)

const execution = result.stages.find((s) => s.stageId === "revenue_execution")
assert.ok(execution?.parseOk)
assert.equal(execution?.status, "ok")

const pagePath = path.join(process.cwd(), "app/(admin)/admin/growth/leads/lead-engine/page.tsx")
const pageSource = fs.readFileSync(pagePath, "utf8")
assert.match(pageSource, /GROWTH_LEAD_ENGINE_WORKSPACE_QA_MARKER/)
assert.match(pageSource, /GrowthLeadEngineWorkspace/)

const navPath = path.join(process.cwd(), "components/growth/growth-section-sidebar-nav.tsx")
const navSource = fs.readFileSync(navPath, "utf8")
assert.match(navSource, /\/admin\/growth\/leads\/lead-engine/)
assert.match(navSource, /Lead Engine/)

console.log("lead-engine-workspace.test.ts: all checks passed")
