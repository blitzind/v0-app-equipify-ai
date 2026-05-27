/**
 * Regression checks for deliverability intelligence (Phase 2).
 * Run: pnpm test:growth-deliverability-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER } from "../lib/growth/deliverability/deliverability-intelligence-types"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"

const DELIVERABILITY_MIGRATION = "20270529120000_growth_deliverability_intelligence.sql"

async function main(): Promise<void> {
  assert.equal(GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER, "growth-deliverability-intelligence-v1")
  assert.ok(GROWTH_CRON_ROUTE_IDS.includes("growth-dns-verify"))

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${DELIVERABILITY_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /delivery_event_timeline/)
  assert.match(migration, /domain_health_snapshots/)
  assert.match(migration, /deliverability_protection_events/)
  assert.match(migration, /verification_source/)

  const liveDns = fs.readFileSync(path.join(process.cwd(), "lib/growth/deliverability/live-dns-verifier.ts"), "utf8")
  assert.match(liveDns, /live_dns_verification_disabled/)
  assert.match(liveDns, /manual_override/)
  assert.match(liveDns, /GROWTH_LIVE_DNS_VERIFICATION/)

  const protection = fs.readFileSync(path.join(process.cwd(), "lib/growth/deliverability/protection-rules.ts"), "utf8")
  assert.match(protection, /pause_sender/)
  assert.match(protection, /pause_domain/)
  assert.match(protection, /deliverability_protection_events/)

  const timeline = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/deliverability/delivery-event-timeline.ts"),
    "utf8",
  )
  assert.match(timeline, /dedupe_key/)
  assert.match(timeline, /provider_rejected/)

  const dashboard = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-internal-outbound-operations-dashboard.tsx"),
    "utf8",
  )
  assert.match(dashboard, /GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER/)
  assert.match(dashboard, /domain-readiness/)
  assert.match(dashboard, /timeline/)

  const cronRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-dns-verify/route.ts"),
    "utf8",
  )
  assert.match(cronRoute, /runDeliverabilityIntelligenceScan/)

  const vercel = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
  assert.match(vercel, /growth-dns-verify/)

  const domainReadiness = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/infrastructure/domain-readiness.ts"),
    "utf8",
  )
  assert.match(domainReadiness, /LIVE VERIFIED/)
  assert.match(domainReadiness, /MANUAL OVERRIDE/)

  console.log("growth deliverability intelligence tests passed")
}

void main()
