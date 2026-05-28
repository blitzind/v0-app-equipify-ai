/**
 * Regression checks for Growth Engine H3 — Operator UX simplification.
 * Run: pnpm test:growth-operator-ux-h3
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_DELIVERABILITY_IA,
  GROWTH_OPERATOR_DAILY_WORKFLOW,
  GROWTH_OPERATOR_DIAGNOSTICS_DISCLOSURE_QA_MARKER,
  GROWTH_OPERATOR_UX_H3_QA_MARKER,
} from "../lib/growth/operator-ux/operator-ux-h3-types"
import {
  GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER,
  GROWTH_ATTENTION_QUIET_HEALTHY_QA_MARKER,
  hasActionableOperatorAttention,
  hasActionableDnsSetupStatus,
  hasActionableGrowthSidebarHealth,
  isActionableInfrastructureReadiness,
} from "../lib/growth/operator-ux/operator-attention-utils"
import { GROWTH_NAV_GROUP_DEFS } from "../lib/growth/navigation/growth-navigation-destinations"

assert.equal(GROWTH_OPERATOR_UX_H3_QA_MARKER, "growth-operator-ux-h3-v1")
assert.equal(GROWTH_ATTENTION_QUIET_HEALTHY_QA_MARKER, "growth-attention-quiet-healthy-v1")
assert.equal(GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER, "growth-attention-actionable-only-v1")
assert.equal(hasActionableOperatorAttention({ items: [] }), false)
assert.equal(hasActionableOperatorAttention({ items: [{ id: "x", category: "approval", label: "x", summary: "x", count: 1, href: "/", severity: "medium" }] }), true)
assert.equal(isActionableInfrastructureReadiness("live"), false)
assert.equal(isActionableInfrastructureReadiness("degraded"), true)
assert.equal(hasActionableGrowthSidebarHealth({ systemHealthLabel: "Healthy" }), false)
assert.equal(hasActionableGrowthSidebarHealth({ pendingApproval: 2, systemHealthLabel: "Healthy" }), true)
assert.equal(hasActionableDnsSetupStatus({ workingToday: ["a"], notConnectedYet: [], nextSteps: [] }), false)
assert.equal(hasActionableDnsSetupStatus({ workingToday: [], notConnectedYet: ["b"], nextSteps: [] }), true)
assert.equal(GROWTH_OPERATOR_DIAGNOSTICS_DISCLOSURE_QA_MARKER, "growth-operator-diagnostics-disclosure-v1")
assert.equal(GROWTH_DELIVERABILITY_IA.protection.label, "Protection")
assert.equal(GROWTH_DELIVERABILITY_IA.infrastructure.label, "DNS & Setup")
assert.equal(GROWTH_DELIVERABILITY_IA.operations.label, "Deliverability Ops")
assert.ok(GROWTH_OPERATOR_DAILY_WORKFLOW.length >= 7)

const operationsGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "providers-nav")
assert.equal(operationsGroup?.label, "Delivery Ops")
assert.ok(operationsGroup?.items.some((i) => i.label === "Outbound Console"))
assert.ok(operationsGroup?.items.some((i) => i.label === "Provider Connections"))
assert.ok(operationsGroup?.items.some((i) => i.label === "Outbound Readiness"))
assert.ok(operationsGroup?.items.some((i) => i.label === "Deliverability"))
assert.ok(operationsGroup?.items.some((i) => i.label === "Diagnostics"))
assert.ok(!operationsGroup?.items.some((i) => i.label === "DNS & Setup"))
assert.ok(!operationsGroup?.items.some((i) => i.label === "Diagnostics (Advanced)"))

const attentionStripSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-operator-attention-strip.tsx"),
  "utf8",
)
assert.match(attentionStripSource, /GROWTH_OPERATOR_UX_H3_QA_MARKER/)
assert.match(attentionStripSource, /GROWTH_ATTENTION_QUIET_HEALTHY_QA_MARKER/)
assert.match(attentionStripSource, /GROWTH_ATTENTION_ACTIONABLE_ONLY_QA_MARKER/)
assert.match(attentionStripSource, /hasActionableOperatorAttention/)
assert.doesNotMatch(attentionStripSource, /No urgent operator attention right now/)
assert.match(attentionStripSource, /\/api\/platform\/growth\/operator\/attention-strip/)

const sectionLayoutSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-layout.tsx"),
  "utf8",
)
assert.match(sectionLayoutSource, /GrowthOperatorAttentionStrip/)
assert.match(sectionLayoutSource, /growth-attention-quiet-healthy-v1/)

const communicationOpsSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-communication-ops-section.tsx"),
  "utf8",
)
assert.doesNotMatch(communicationOpsSource, /Communication queues are clear/)
assert.match(communicationOpsSource, /hasActionableCommunicationOpsMetrics/)

const readinessStripSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-infrastructure-readiness-strip.tsx"),
  "utf8",
)
assert.match(readinessStripSource, /isActionableInfrastructureReadiness/)

const commandCenterSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-center-dashboard.tsx"),
  "utf8",
)
assert.match(commandCenterSource, /GrowthOperatorAttentionStrip/)
assert.doesNotMatch(commandCenterSource, /Queue is clear — no ranked actions right now/)
assert.match(commandCenterSource, /GrowthOperatorDailyWorkflow/)
assert.match(commandCenterSource, /GROWTH_OPERATOR_UX_H3_QA_MARKER/)
assert.doesNotMatch(commandCenterSource, /Today's Pipeline Operations/)

const outboundPageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/operations/outbound/page.tsx"),
  "utf8",
)
assert.match(outboundPageSource, /Outbound Console/)

const disclosureSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-operator-diagnostics-disclosure.tsx"),
  "utf8",
)
assert.match(disclosureSource, /GROWTH_OPERATOR_DIAGNOSTICS_DISCLOSURE_QA_MARKER/)
assert.match(disclosureSource, /aria-expanded/)

console.log("growth-operator-ux-h3: all checks passed")
