/**
 * Phase GS-1D — Signal Feed certification.
 *
 * Local: pnpm test:signal-feed
 * Production: pnpm test:signal-feed:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { REVENUE_PATH_HENRY_LEAD_ID } from "../lib/growth/qa/revenue-path-validation-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { buildSignalRecommendations } from "../lib/growth/signal-intelligence/signal-recommendation-engine"
import { estimateSignalExpectedImpact } from "../lib/growth/signal-intelligence/signal-revenue-impact-estimators"
import {
  ALLOWED_SIGNAL_FEED_ACTIONS,
  SIGNAL_FEED_EXECUTE_CONFIRM,
  buildSignalFeedReadinessPayload,
} from "../lib/growth/signal-intelligence/signal-feed-route-gates"
import { SIGNAL_FEED_QA_MARKER } from "../lib/growth/signal-intelligence/signal-feed-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GS-1D local regression (${SIGNAL_FEED_QA_MARKER}) ===\n`)

  assert.equal(SIGNAL_FEED_QA_MARKER, "growth-signal-feed-gs1d-v1")
  console.log("  ✓ QA marker")

  const requiredFiles = [
    "lib/growth/signal-intelligence/signal-feed-types.ts",
    "lib/growth/signal-intelligence/signal-feed-repository.ts",
    "lib/growth/signal-intelligence/signal-recommendation-engine.ts",
    "lib/growth/signal-intelligence/signal-revenue-impact-estimators.ts",
    "lib/growth/signal-intelligence/signal-feed-route-gates.ts",
    "lib/growth/signal-intelligence/signal-feed-route.ts",
    "app/api/platform/growth/signals/feed/route.ts",
    "app/api/platform/growth/signals/feed/actions/route.ts",
    "app/api/platform/growth/signal-feed/readiness/route.ts",
    "components/growth/growth-signal-feed-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-1D module files exist")

  const rec = buildSignalRecommendations({
    event: {
      signalType: "company_hiring",
      sourceDomain: "company",
      confidence: 0.85,
      urgency: "high",
      routeActions: ["timeline", "attention", "queue_hint"],
    },
    lead: { engagement_tier: "hot", opportunity_readiness_tier: "sales_ready" },
    account_playbook_key: "biomedical",
  })
  assert.ok(rec.recommended_action.length > 0)
  assert.equal(rec.requires_human_approval, true)
  console.log("  ✓ buildSignalRecommendations")

  const impact = estimateSignalExpectedImpact("pricing_page_visit")
  assert.ok(impact.summary.includes("Meeting likelihood"))
  console.log("  ✓ revenue impact estimators")

  const readiness = buildSignalFeedReadinessPayload()
  assert.equal(readiness.execute_confirm, SIGNAL_FEED_EXECUTE_CONFIRM)
  assert.equal(readiness.no_outreach_execution, true)
  assert.deepEqual(readiness.allowed_feed_actions, ALLOWED_SIGNAL_FEED_ACTIONS)
  console.log("  ✓ feed route gates — no outreach execution")

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/signals/feed/actions/route.ts"),
    "utf8",
  )
  assert.ok(actionsRoute.includes("applySignalFeedAction"))
  assert.ok(actionsRoute.includes("outreach_execution: false"))
  assert.ok(!actionsRoute.includes("enroll"))
  assert.ok(!actionsRoute.includes("executeOutreach"))
  assert.ok(!actionsRoute.includes("sendSequence"))
  console.log("  ✓ feed actions API is status-only")

  console.log("\n  Local regression: PASS\n")
}

async function runProductionCertification(): Promise<Record<string, unknown>> {
  process.env.GROWTH_SIGNAL_INTELLIGENCE_ENABLED = "true"
  process.env.GROWTH_SIGNAL_INTELLIGENCE_ACK = "1"
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
  const { executeSignalFeedCertification } = await import(
    "../lib/growth/signal-intelligence/signal-feed-route"
  )
  return executeSignalFeedCertification(admin, { henry_lead_id: REVENUE_PATH_HENRY_LEAD_ID })
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
          qa_marker: SIGNAL_FEED_QA_MARKER,
          hint: "Run pnpm test:signal-feed:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-1D production certification (${SIGNAL_FEED_QA_MARKER}) ===\n`)
  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
