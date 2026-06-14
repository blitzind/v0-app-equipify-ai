/**
 * Phase RV-1B — Revenue persistence integrity certification.
 *
 * Local:
 *   pnpm test:revenue-persistence-integrity
 *
 * Production investigate + repair Henry draft:
 *   pnpm repair:henry-opportunity-persistence:production
 *
 * Production full re-certification:
 *   pnpm test:revenue-persistence-integrity:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  REVENUE_INTEGRITY_EXECUTE_CONFIRM,
  REVENUE_INTEGRITY_HENRY_DRAFT_ID,
  REVENUE_INTEGRITY_QA_MARKER,
  REVENUE_PERSISTENCE_INTEGRITY_CHECKS,
} from "../lib/growth/revenue-integrity/revenue-integrity-types"
import { validateRevenueIntegrityCertificationConfirmation } from "../lib/growth/revenue-integrity/revenue-integrity-route-gates"

function runLocalRegression(): void {
  console.log(`\n=== RV-1B local regression (${REVENUE_INTEGRITY_QA_MARKER}) ===\n`)

  assert.equal(REVENUE_INTEGRITY_QA_MARKER, "revenue-integrity-rv1b-v1")
  assert.equal(REVENUE_PERSISTENCE_INTEGRITY_CHECKS.length, 9)
  console.log("  ✓ QA marker and check count")

  const required = [
    "lib/growth/revenue-integrity/revenue-integrity-types.ts",
    "lib/growth/revenue-integrity/investigate-opportunity-draft-persistence.ts",
    "lib/growth/revenue-integrity/repair-opportunity-draft-persistence.ts",
    "lib/growth/revenue-integrity/revenue-integrity-certification.ts",
    "lib/growth/revenue-integrity/revenue-integrity-route.ts",
    "app/api/platform/growth/revenue-integrity/readiness/route.ts",
    "app/api/platform/growth/revenue-integrity/execute/route.ts",
  ]
  for (const relativePath of required) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ required modules and routes")

  const approvalSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-approval-service.ts"),
    "utf8",
  )
  assert.match(approvalSource, /deleteGrowthOpportunityRow/)
  console.log("  ✓ compensating rollback wired in confirmCreateOpportunityFromDraft")

  const confirm = validateRevenueIntegrityCertificationConfirmation({
    confirm: REVENUE_INTEGRITY_EXECUTE_CONFIRM,
    draft_id: REVENUE_INTEGRITY_HENRY_DRAFT_ID,
  })
  assert.equal(confirm.ok, true)
  console.log("  ✓ execute confirmation gate")

  const badConfirm = validateRevenueIntegrityCertificationConfirmation({ confirm: "wrong" })
  assert.equal(badConfirm.ok, false)
  console.log("  ✓ rejects invalid confirmation token")

  console.log("\n  Local regression: PASS\n")
}

async function runProductionCertification(repair: boolean): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_unavailable" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { auditCreateGrowthOpportunityWriteOrder, certifyRevenuePersistenceIntegrity } = await import(
    "../lib/growth/revenue-integrity/revenue-integrity-certification"
  )

  const writeOrderAudit = auditCreateGrowthOpportunityWriteOrder()
  const certification = await certifyRevenuePersistenceIntegrity(admin, {
    draft_id: REVENUE_INTEGRITY_HENRY_DRAFT_ID,
    repair,
    operator_email: "revenue-integrity-cert@equipify.internal",
  })

  console.log(
    JSON.stringify(
      {
        ok: certification.certified,
        phase: "RV-1B",
        repair_attempted: repair,
        certification_pct: certification.certification_pct,
        checks: certification.checks,
        blockers: certification.blockers,
        investigation: certification.investigation,
        repair: certification.repair,
        write_order_audit: writeOrderAudit,
        root_cause: certification.investigation.root_cause_hypothesis,
      },
      null,
      2,
    ),
  )

  if (!certification.certified) process.exit(1)
}

async function main(): Promise<void> {
  const production = process.argv.includes("--production")
  const repair = process.argv.includes("--repair")

  runLocalRegression()

  if (!production) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          hint: "pnpm test:revenue-persistence-integrity:production [--repair]",
        },
        null,
        2,
      ),
    )
    return
  }

  await runProductionCertification(repair)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
