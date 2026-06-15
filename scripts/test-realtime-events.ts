/**
 * Phase GS-4C — Real-Time Event Bus certification.
 *
 * Local: pnpm test:realtime-events
 * Production: pnpm test:realtime-events:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { normalizeGrowthRealtimeEvent } from "../lib/growth/realtime-events/realtime-events-normalizer"
import { scoreGrowthRealtimeEvent } from "../lib/growth/realtime-events/realtime-events-priority"
import { routeGrowthRealtimeEvent, buildEnvelope } from "../lib/growth/realtime-events/realtime-events-router"
import { buildRealtimeEventsReadinessPayload } from "../lib/growth/realtime-events/realtime-events-route-gates"
import {
  REALTIME_EVENTS_CONFIRM,
  REALTIME_EVENTS_QA_MARKER,
} from "../lib/growth/realtime-events/realtime-events-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GS-4C local regression (${REALTIME_EVENTS_QA_MARKER}) ===\n`)

  assert.equal(REALTIME_EVENTS_QA_MARKER, "growth-realtime-events-gs4c-v1")
  assert.equal(REALTIME_EVENTS_CONFIRM, "RUN_REALTIME_EVENTS_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/realtime-events/realtime-events-types.ts",
    "lib/growth/realtime-events/realtime-events-normalizer.ts",
    "lib/growth/realtime-events/realtime-events-router.ts",
    "lib/growth/realtime-events/realtime-events-subscriber.ts",
    "lib/growth/realtime-events/realtime-events-service.ts",
    "lib/growth/realtime-events/realtime-events-certification.ts",
    "app/api/platform/growth/realtime-events/route.ts",
    "app/api/platform/growth/realtime-events/publish/route.ts",
    "app/api/platform/growth/realtime-events/actions/route.ts",
    "components/growth/growth-realtime-event-bus-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-4C module files exist")

  const routes = routeGrowthRealtimeEvent({
    event_type: "campaign_readiness.updated",
    source: "campaign_readiness",
    qa_marker: "growth-campaign-readiness-gs2e-v1",
    lead_id: "lead-1",
  })
  assert.ok(routes.some((r) => r.subscriber === "campaign_readiness"))
  assert.ok(routes.some((r) => r.subscriber === "command_center"))
  console.log("  ✓ deterministic routing")

  const envelope = buildEnvelope({
    event_id: "evt-1",
    event_type: "scored",
    source: "realtime_event_bus",
    organization_id: "org-1",
    payload: { test: true },
    created_at: new Date().toISOString(),
  })
  assert.equal(envelope.requires_human_review, true)
  assert.equal(envelope.autonomous_execution_enabled, false)
  assert.equal(envelope.outreach_execution, false)
  assert.equal(envelope.enrollment_execution, false)
  console.log("  ✓ envelope contract")

  const normalized = normalizeGrowthRealtimeEvent({
    id: "row-1",
    organization_id: "org-1",
    event_type: "scored",
    occurred_at: new Date().toISOString(),
    event_payload: {
      qa_marker: REALTIME_EVENTS_QA_MARKER,
      event_name: "realtime_event_published",
      realtime_event: true,
      routes,
    },
  })
  assert.equal(normalized.qa_marker, REALTIME_EVENTS_QA_MARKER)
  assert.equal(scoreGrowthRealtimeEvent(normalized), scoreGrowthRealtimeEvent(normalized))
  console.log("  ✓ normalize and deterministic scoring")

  const readiness = buildRealtimeEventsReadinessPayload()
  assert.equal(readiness.no_outreach_execution, true)
  assert.equal(readiness.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics")

  const publishRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/realtime-events/publish/route.ts"),
    "utf8",
  )
  assert.ok(publishRoute.includes("outreach_execution: false"))
  assert.ok(!publishRoute.includes("enrollLeadInSequence"))
  console.log("  ✓ publish API — audit only")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-realtime-event-bus-panel.tsx"),
    "utf8",
  )
  assert.ok(uiSource.includes("View Event"))
  assert.ok(uiSource.includes("Mark Reviewed"))
  assert.ok(uiSource.includes("Dismiss"))
  assert.ok(!uiSource.match(/\bSend\b/))
  assert.ok(!uiSource.includes("Launch"))
  assert.ok(!uiSource.includes("Enroll"))
  console.log("  ✓ UI — human-gated actions only")

  const subscriberSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/realtime-events/realtime-events-subscriber.ts"),
    "utf8",
  )
  assert.ok(subscriberSource.includes("pollingIntervalMs"))
  assert.ok(subscriberSource.includes("postgres_changes"))
  console.log("  ✓ subscribe with polling fallback")

  console.log("\nGS-4C local regression PASS\n")
}

async function runProductionCertification(): Promise<Record<string, unknown>> {
  process.env.VERCEL_ENV = process.env.VERCEL_ENV ?? "production"

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeRealtimeEventsCertification } = await import(
    "../lib/growth/realtime-events/realtime-events-certification"
  )
  return executeRealtimeEventsCertification(admin, {})
}

async function main(): Promise<void> {
  const productionOnly = process.argv.includes("--production")
  runLocalRegression()

  if (!productionOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: REALTIME_EVENTS_QA_MARKER,
          hint: "Run pnpm test:realtime-events:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict !== "PASS") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
