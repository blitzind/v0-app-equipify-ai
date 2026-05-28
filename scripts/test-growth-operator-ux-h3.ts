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
import { GROWTH_NAV_GROUP_DEFS } from "../lib/growth/navigation/growth-navigation-destinations"

assert.equal(GROWTH_OPERATOR_UX_H3_QA_MARKER, "growth-operator-ux-h3-v1")
assert.equal(GROWTH_OPERATOR_DIAGNOSTICS_DISCLOSURE_QA_MARKER, "growth-operator-diagnostics-disclosure-v1")
assert.equal(GROWTH_DELIVERABILITY_IA.protection.label, "Protection")
assert.equal(GROWTH_DELIVERABILITY_IA.infrastructure.label, "DNS & Setup")
assert.equal(GROWTH_DELIVERABILITY_IA.operations.label, "Deliverability Ops")
assert.ok(GROWTH_OPERATOR_DAILY_WORKFLOW.length >= 7)

const operationsGroup = GROWTH_NAV_GROUP_DEFS.find((g) => g.id === "providers-nav")
assert.equal(operationsGroup?.label, "Operations")
assert.ok(operationsGroup?.items.some((i) => i.label === "Outbound Console"))
assert.ok(operationsGroup?.items.some((i) => i.label === "Protection"))
assert.ok(operationsGroup?.items.some((i) => i.label === "DNS & Setup"))
assert.ok(operationsGroup?.items.some((i) => i.label === "Deliverability Ops"))
assert.ok(operationsGroup?.items.some((i) => i.label === "Diagnostics (Advanced)"))
assert.ok(!operationsGroup?.items.some((i) => i.label === "Provider Diagnostics"))

const attentionStripSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-operator-attention-strip.tsx"),
  "utf8",
)
assert.match(attentionStripSource, /GROWTH_OPERATOR_UX_H3_QA_MARKER/)
assert.match(attentionStripSource, /\/api\/platform\/growth\/operator\/attention-strip/)

const sectionLayoutSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-section-layout.tsx"),
  "utf8",
)
assert.match(sectionLayoutSource, /GrowthOperatorAttentionStrip/)

const commandCenterSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-center-dashboard.tsx"),
  "utf8",
)
assert.match(commandCenterSource, /GrowthOperatorAttentionStrip/)
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
