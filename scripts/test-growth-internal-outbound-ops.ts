/**
 * Regression checks for internal outbound operations (Phase 1).
 * Run: pnpm test:growth-internal-outbound-ops
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER } from "../lib/growth/operations/internal-outbound-ops-types"
import { GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER } from "../lib/growth/deliverability/deliverability-intelligence-types"
import { GROWTH_INFRASTRUCTURE_READINESS_STATUSES } from "../lib/growth/infrastructure/infrastructure-readiness-types"

const INTERNAL_OUTBOUND_AUDIT_MIGRATION = "20270528120000_growth_engine_internal_outbound_ops.sql"

async function main(): Promise<void> {
  assert.equal(GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER, "growth-internal-outbound-ops-v1")
  assert.ok(GROWTH_INFRASTRUCTURE_READINESS_STATUSES.includes("error"))
  assert.ok(GROWTH_INFRASTRUCTURE_READINESS_STATUSES.includes("degraded"))

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${INTERNAL_OUTBOUND_AUDIT_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /internal_outbound_audit_events/)
  assert.match(migration, /operational_pause_reason/)

  const page = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/infrastructure/outbound-operations/page.tsx"),
    "utf8",
  )
  assert.match(page, /GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER/)
  assert.match(page, /data-qa-marker/)

  const infraPage = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/infrastructure/page.tsx"),
    "utf8",
  )
  assert.match(infraPage, /GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER/)

  const preSend = fs.readFileSync(path.join(process.cwd(), "lib/growth/compliance/pre-send-assertion.ts"), "utf8")
  assert.match(preSend, /evaluatePreSendInfrastructureAllowed/)
  assert.match(preSend, /GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER/)

  const infraGuards = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/compliance/pre-send-infrastructure-guards.ts"),
    "utf8",
  )
  assert.match(infraGuards, /domain_protection/)
  assert.match(infraGuards, /sender_paused/)

  const pause = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sender-pools/sender-operational-pause.ts"),
    "utf8",
  )
  assert.match(pause, /NO automatic re-enable/)
  assert.match(pause, /applyOperationalPauseForFatigue/)

  const domainReadiness = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/infrastructure/domain-readiness.ts"),
    "utf8",
  )
  assert.match(domainReadiness, /MANUAL VERIFICATION REQUIRED|MANUAL OVERRIDE|LIVE VERIFIED/)

  const dashboard = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/operations/internal-outbound-operations-dashboard.ts"),
    "utf8",
  )
  assert.match(dashboard, /mailboxes/)
  assert.match(dashboard, /sender_pools/)
  assert.match(dashboard, /google_provider/)

  const outboundDashboard = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/operations/outbound-operations-dashboard.ts"),
    "utf8",
  )
  assert.match(outboundDashboard, /outboundActivation/)
  assert.match(outboundDashboard, /resolveOutboundExecutionActivationState/)

  const sendInfraUi = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-internal-outbound-operations-dashboard.tsx"),
    "utf8",
  )
  assert.match(sendInfraUi, /GROWTH_SEND_INFRASTRUCTURE_RUNTIME_STABLE_V2_QA_MARKER/)
  assert.match(sendInfraUi, /GrowthSendInfrastructureErrorBoundary/)
  assert.match(sendInfraUi, /sanitizeSendInfrastructureUiError/)
  assert.doesNotMatch(sendInfraUi, /No urgent operator attention right now/)

  console.log("growth internal outbound ops tests passed")
}

void main()
