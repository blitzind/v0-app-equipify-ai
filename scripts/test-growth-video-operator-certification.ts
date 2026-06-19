/**
 * Growth Engine E1 — Video operator end-to-end certification.
 *
 * Local: pnpm test:growth-video-operator-certification
 * Production: pnpm test:growth-video-operator-certification:production
 */
import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"
import {
  formatGrowthVideoOperatorCertificationSummary,
  GROWTH_VIDEO_OPERATOR_CERT_CONFIRM,
  GROWTH_VIDEO_OPERATOR_CERT_QA_MARKER,
  runGrowthVideoOperatorCertificationLocal,
  runGrowthVideoOperatorCertificationProduction,
} from "../lib/growth/e2e/growth-video-operator-certification"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  assert.equal(GROWTH_VIDEO_OPERATOR_CERT_QA_MARKER, "growth-video-operator-certification-e1-v1")
  assert.equal(GROWTH_VIDEO_OPERATOR_CERT_CONFIRM, "RUN_GROWTH_VIDEO_OPERATOR_CERTIFICATION")

  const report = runGrowthVideoOperatorCertificationLocal()
  console.log(formatGrowthVideoOperatorCertificationSummary(report))

  assert.equal(report.environment, "local")
  assert.ok(report.scenario_matrix.length >= 10, "Expected at least 10 certification scenarios")
  assert.ok(report.section_reports.length === 10, "Expected 10 operator report sections")

  for (const section of report.section_reports) {
    assert.ok(["PASS", "WARN", "FAIL"].includes(section.status))
    assert.ok(section.label.length > 0)
  }

  assert.equal(report.final_verdict, "PASS", `Local certification failed: ${report.blockers.join(", ")}`)
  assert.equal(report.ok, true)
  assert.equal(report.requires_human_review, true)
  assert.equal(report.autonomous_execution_enabled, false)
  assert.equal(report.outreach_execution, false)

  console.log(
    JSON.stringify({
      ok: true,
      local_only: true,
      qa_marker: GROWTH_VIDEO_OPERATOR_CERT_QA_MARKER,
      scenario_count: report.scenario_matrix.length,
      section_count: report.section_reports.length,
      hint: "Run pnpm test:growth-video-operator-certification:production for Vercel Production schema certification",
    }),
  )
}

async function runProductionCertification(): Promise<Record<string, unknown>> {
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

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false, autoRefreshToken: false } })

  const report = await runGrowthVideoOperatorCertificationProduction(admin)
  console.log(formatGrowthVideoOperatorCertificationSummary(report))

  const payload = {
    ok: report.ok,
    qa_marker: report.qa_marker,
    final_verdict: report.final_verdict,
    environment: report.environment,
    scenario_count: report.scenario_matrix.length,
    section_reports: report.section_reports.map((section) => ({
      section_id: section.section_id,
      label: section.label,
      status: section.status,
      pass_count: section.pass_count,
      check_count: section.check_count,
      root_cause: section.root_cause,
      recommended_fix: section.recommended_fix,
      blocking_severity: section.blocking_severity,
    })),
    pass_count: report.pass_count,
    warn_count: report.warn_count,
    fail_count: report.fail_count,
    check_count: report.check_count,
    blockers: report.blockers,
    requires_human_review: report.requires_human_review,
    autonomous_execution_enabled: report.autonomous_execution_enabled,
    outreach_execution: report.outreach_execution,
    enrollment_execution: report.enrollment_execution,
    orchestration_enabled: report.orchestration_enabled,
  }

  console.log(JSON.stringify(payload, null, 2))

  if (!report.ok) {
    throw new Error(`Production certification failed: ${report.blockers.join(", ")}`)
  }

  console.log("\nE1 Video operator production certification PASS\n")
  return payload
}

async function main(): Promise<void> {
  runLocalRegression()

  if (process.argv.includes("--production")) {
    await runProductionCertification()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
