/**
 * Regression checks for Growth Engine revenue intelligence Phase 6.
 * Run: pnpm test:growth-revenue-intelligence-v1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { computeBuyingMomentum } from "../lib/growth/revenue-intelligence/buying-momentum-engine"
import { buildBuyingCommitteeMap } from "../lib/growth/revenue-intelligence/buying-committee-map"
import { detectOpportunitySignalsFromReplyV2 } from "../lib/growth/revenue-intelligence/opportunity-signal-engine"
import { buildRevenueIntelligenceCopilot } from "../lib/growth/revenue-intelligence/revenue-copilot-service"
import { classifyReplyIntentV2 } from "../lib/growth/reply-intelligence/reply-intent-classifier-v2"
import { extractBuyingSignals } from "../lib/growth/reply-intelligence/buying-signal-extractor"
import {
  GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
  GROWTH_OPPORTUNITY_WORKSPACE_VIEWS,
} from "../lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

assert.equal(GROWTH_REVENUE_INTELLIGENCE_QA_MARKER, "growth-revenue-intelligence-v1")
assert.ok(GROWTH_OPPORTUNITY_WORKSPACE_VIEWS.includes("demo_ready"))

const classified = classifyReplyIntentV2("Can we schedule a demo? What is pricing for 20 users?")
const buying = extractBuyingSignals("Can we schedule a demo? What is pricing for 20 users?")
const signals = detectOpportunitySignalsFromReplyV2({
  bodyPreview: "Can we schedule a demo? What is pricing for 20 users?",
  classification: classified,
  buyingSignals: buying,
  threadReplyCount: 2,
  responseLatencyMs: 30 * 60 * 1000,
})
assert.ok(signals.some((s) => s.signalType === "demo_request"))
assert.ok(signals.every((s) => s.excerpt.length > 0))

const momentum = computeBuyingMomentum({
  threadReplyCount: 2,
  responseLatencyMs: 30 * 60 * 1000,
  buyingSignalCount: buying.length,
  objectionCount: 0,
  resolvedObjectionCount: 0,
  outboundMessageCount: 3,
  stakeholderCount: 1,
})
assert.ok(momentum.momentumScore >= 0 && momentum.momentumScore <= 100)
assert.ok(momentum.explainability.length > 0)

const committee = buildBuyingCommitteeMap({
  leadId: "00000000-0000-0000-0000-000000000001",
  companyLabel: "Acme",
  bodyPreview: "Looping in our VP of Operations for this evaluation.",
  signals,
})
assert.ok(committee.committeeMembers.length > 0)

const copilot = buildRevenueIntelligenceCopilot({
  companyLabel: "Acme",
  momentum,
  signals,
  objectionCategories: [],
  committeeCompleteness: committee.completenessScore,
  missingStakeholders: committee.missingStakeholderSuggestions,
})
assert.equal(copilot.assistedLabel, "AI-assisted")
assert.equal(copilot.qaMarker, GROWTH_REVENUE_INTELLIGENCE_QA_MARKER)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270602120000_growth_revenue_intelligence_v1.sql"),
  "utf8",
)
assert.match(migrationSource, /buying_momentum_snapshots/)
assert.match(migrationSource, /campaign_revenue_attribution_snapshots/)
assert.match(migrationSource, /growth-revenue-intelligence-v1/)

const processSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-intelligence/process-revenue-intelligence.ts"),
  "utf8",
)
assert.match(processSource, /processRevenueIntelligence/)

const replyProcess = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/reply-intelligence/process-reply-intelligence.ts"),
  "utf8",
)
assert.match(replyProcess, /processRevenueIntelligence/)

const workspaceUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-opportunity-workspace-dashboard.tsx"),
  "utf8",
)
assert.match(workspaceUi, /GROWTH_REVENUE_INTELLIGENCE_QA_MARKER/)
assert.match(workspaceUi, /Buying momentum/)

const executiveUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-executive-revenue-section.tsx"),
  "utf8",
)
assert.match(executiveUi, /GROWTH_REVENUE_INTELLIGENCE_QA_MARKER/)

console.log("growth-revenue-intelligence-v1: all checks passed")
