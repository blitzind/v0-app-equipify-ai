/**
 * GE-AIOS-LAUNCH-1D — Runtime completion wiring smoke test (local).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { routeWorkItem } from "../lib/growth/specialists/router/route-work-item"
import { isDiscoveryMissionWorkItem } from "../lib/growth/specialists/execution/growth-asl-discovery-mission-work-items-launch-1d"
import type { AvaWorkItem } from "../lib/growth/work-manager/types"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function workItem(partial: Partial<AvaWorkItem> & Pick<AvaWorkItem, "id" | "type" | "title">): AvaWorkItem {
  return {
    status: "ready",
    priority: 80,
    source: "decision_engine",
    created_at: "2026-07-21T00:00:00.000Z",
    updated_at: "2026-07-21T00:00:00.000Z",
    description: null,
    estimated_minutes: 5,
    estimated_revenue_impact: 50,
    requires_operator: false,
    can_execute_autonomously: true,
    depends_on: [],
    blocked_by: [],
    next_action: null,
    decision_score: 80,
    confidence: 80,
    href: null,
    company_name: null,
    decision_source_id: partial.id.replace(/^work:/, ""),
    relationship_graph: null,
    ...partial,
  }
}

const refreshAudience = workItem({
  id: "work:discovery:refresh_audience",
  type: "mission",
  title: "Refresh audience — Healthcare ICP",
})
assert.equal(routeWorkItem(refreshAudience).specialist_id, "sales", "Refresh audience routes to sales, not marketing stub")

const beginResearch = workItem({
  id: "work:discovery:begin_research",
  type: "research",
  title: "Begin research — Healthcare Audience",
})
assert.equal(routeWorkItem(beginResearch).specialist_id, "sales", "Begin research routes to sales despite audience keyword")

assert.equal(isDiscoveryMissionWorkItem(refreshAudience), true)

const executeAgentSource = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
const discoveryExecution = readSource("lib/growth/specialists/execution/growth-asl-discovery-mission-execution-launch-1d.ts")
assert.match(executeAgentSource, /executeDiscoveryMissionWorkItem/)
assert.match(discoveryExecution, /runGrowthMissionRuntimeOrchestration/)

const bridge = readSource("lib/growth/work-manager/bridges/decision-engine-bridge.ts")
assert.match(bridge, /requiresLeadTarget/)

const draftFactory = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
assert.match(draftFactory, /dmIntegrity\.ok/)

const dmService = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-service.ts")
assert.match(dmService, /admissionState === \"rejected\"/)

console.log("GE-AIOS-LAUNCH-1D runtime completion wiring smoke test passed")
