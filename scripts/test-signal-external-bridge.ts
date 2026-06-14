/**
 * Phase GS-1C — External signal → lead rescore bridge certification.
 *
 * Local:
 *   pnpm test:signal-external-bridge
 *
 * Production:
 *   pnpm test:signal-external-bridge:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { REVENUE_PATH_HENRY_LEAD_ID } from "../lib/growth/qa/revenue-path-validation-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  externalSignalWeightPoints,
  externalSignalCommandCenterBoost,
} from "../lib/growth/signal-intelligence/external-signal-scoring"
import {
  SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
  LEAD_SIGNAL_TYPE_SOURCE_DOMAIN,
} from "../lib/growth/signal-intelligence/lead-signal-event-types"
import { resolveSignalQueueHint } from "../lib/growth/signal-intelligence/signal-queue-hints"
import {
  SIGNAL_INTELLIGENCE_EXECUTE_CONFIRM,
  buildSignalIntelligenceReadinessPayload,
} from "../lib/growth/signal-intelligence/signal-intelligence-route-gates"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GS-1C local regression (${SIGNAL_EXTERNAL_BRIDGE_QA_MARKER}) ===\n`)

  assert.equal(SIGNAL_EXTERNAL_BRIDGE_QA_MARKER, "growth-signal-external-bridge-gs1c-v1")
  console.log("  ✓ QA marker")

  const requiredFiles = [
    "lib/growth/signal-intelligence/external-signal-producers.ts",
    "lib/growth/signal-intelligence/signal-lead-matcher.ts",
    "lib/growth/signal-intelligence/external-signal-scoring.ts",
    "lib/growth/signal-intelligence/signal-queue-hints.ts",
    "lib/growth/signal-intelligence/signal-intelligence-route-gates.ts",
    "lib/growth/signal-intelligence/signal-intelligence-route.ts",
    "app/api/platform/growth/signal-intelligence/readiness/route.ts",
    "app/api/platform/growth/signal-intelligence/execute/route.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-1C module files exist")

  assert.equal(externalSignalWeightPoints("funding_event"), 20)
  assert.equal(externalSignalWeightPoints("demo_page_visit"), 25)
  assert.equal(externalSignalCommandCenterBoost("pricing_page_visit"), 6)
  console.log("  ✓ deterministic external signal weights")

  assert.equal(LEAD_SIGNAL_TYPE_SOURCE_DOMAIN.high_intent_search, "external")
  assert.equal(LEAD_SIGNAL_TYPE_SOURCE_DOMAIN.company_hiring, "company")
  assert.equal(LEAD_SIGNAL_TYPE_SOURCE_DOMAIN.pricing_page_visit, "external")
  console.log("  ✓ external/company source domain map")

  const producersSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signal-intelligence/external-signal-producers.ts"),
    "utf8",
  )
  assert.ok(producersSource.includes("export function normalizeLeadSignalEvent"))
  assert.ok(producersSource.includes("export function mapSearchIntentCategory"))
  assert.ok(producersSource.includes("export function mapPagePathToWebsiteIntentSignal"))
  console.log("  ✓ external signal producers exported")

  const hint = resolveSignalQueueHint({
    leadId: "lead-1",
    sourceDomain: "external",
    signalType: "high_intent_search",
    confidence: 0.8,
    urgency: "high",
    evidenceRef: { table: "search_intent_signals", id: "x" },
    attributionImpacting: false,
    recomputeScope: "full",
    routeActions: ["timeline", "attention", "queue_hint"],
  })
  assert.equal(hint?.hint_type, "recommend_sequence")
  assert.equal(hint?.requires_human_approval, true)
  console.log("  ✓ queue hints require human approval")

  const readiness = buildSignalIntelligenceReadinessPayload()
  assert.equal(readiness.execute_confirm, SIGNAL_INTELLIGENCE_EXECUTE_CONFIRM)
  console.log("  ✓ production route gates + confirm token")

  const wired = [
    { file: "lib/growth/search-intent/search-intent-repository.ts", needle: "bridgeSearchIntentSignalRow" },
    { file: "lib/growth/company-growth-signals/growth-signal-repository.ts", needle: "bridgeCompanyGrowthSignalRow" },
    { file: "lib/growth/intent-pixel/capture-intent-event.ts", needle: "bridgeIntentPageviewEvent" },
  ]
  for (const { file, needle } of wired) {
    const content = fs.readFileSync(path.join(process.cwd(), file), "utf8")
    assert.ok(content.includes(needle), `${file} missing ${needle}`)
  }
  console.log("  ✓ ingestion bridges wired")

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
  if (!boot) {
    return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeSignalIntelligenceCertification } = await import(
    "../lib/growth/signal-intelligence/signal-intelligence-route"
  )

  return executeSignalIntelligenceCertification(admin, {
    henry_lead_id: REVENUE_PATH_HENRY_LEAD_ID,
  })
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
          qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
          hint: "Run pnpm test:signal-external-bridge:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-1C production certification (${SIGNAL_EXTERNAL_BRIDGE_QA_MARKER}) ===\n`)
  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
