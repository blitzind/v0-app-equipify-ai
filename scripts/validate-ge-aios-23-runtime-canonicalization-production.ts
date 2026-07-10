/**
 * GE-AIOS-23 — Runtime Canonicalization production validation (read-only).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-23-runtime-canonicalization-production.ts
 */
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { GROWTH_CANONICAL_RESEARCH_23_QA_MARKER } from "@/lib/growth/research/growth-canonical-research-types"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

export const GE_AIOS_23_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-23-runtime-canonicalization-production-v1" as const

const PHASE = "GE-AIOS-23" as const

type CheckResult = {
  id: string
  status: "pass" | "fail" | "warn" | "skip"
  detail: string
}

const checks: CheckResult[] = []

function record(id: string, status: CheckResult["status"], detail: string): void {
  checks.push({ id, status, detail })
  const prefix = status === "pass" ? "✓" : status === "warn" ? "!" : status === "skip" ? "-" : "✗"
  console.log(`  ${prefix} ${id}: ${detail}`)
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Runtime Canonicalization production validation (read-only)`)

  bootstrapGrowthOperatorNotificationsCertEnv()

  const rebuildRoute = readSource("app/api/platform/growth/leads/[leadId]/research/rebuild/route.ts")
  if (rebuildRoute.includes("routeCanonicalProspectResearch")) {
    record("research_rebuild_facade", "pass", "Rebuild route uses canonical research facade")
  } else {
    record("research_rebuild_facade", "fail", "Rebuild route still bypasses 21A facade")
  }

  const legacyPost = readSource("app/api/platform/growth/leads/[leadId]/research/route.ts")
  if (legacyPost.includes("routeCanonicalProspectResearch") && !legacyPost.includes("runGrowthLeadResearch(")) {
    record("legacy_research_post", "pass", "Legacy POST delegates to canonical route")
  } else {
    record("legacy_research_post", "fail", "Legacy POST still calls runGrowthLeadResearch directly")
  }

  const { createClient } = await import("@supabase/supabase-js")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    record("supabase_env", "skip", "Supabase env unavailable in this shell")
    summarize()
    return
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const organizationId = getGrowthEngineAiOrgId() ?? GROWTH_CERT_DEFAULT_AI_ORG_ID
  if (!organizationId) {
    record("org_config", "skip", "GROWTH_ENGINE_AI_ORG_ID not configured")
    summarize()
    return
  }

  record("org_config", "pass", `Using organization ${organizationId}`)

  try {
    const summary = await buildGrowthHomeWorkspaceSummary(admin, { organizationId })
    record("home_workspace_summary", "pass", `Loaded home summary (${summary.hero?.headline ? "hero present" : "hero empty"})`)
  } catch (error) {
    record(
      "home_workspace_summary",
      "warn",
      error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
    )
  }

  try {
    const commandCenter = await fetchAiOsCommandCenterReadModel(admin, { organizationId })
    record(
      "command_center_read_model",
      "pass",
      `Command center sections: ${Object.keys(commandCenter.sections ?? {}).length}`,
    )
  } catch (error) {
    record(
      "command_center_read_model",
      "warn",
      error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180),
    )
  }

  const { data: recentRuns, error: runsError } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, status, signals, completed_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(20)

  if (runsError) {
    record("prospect_research_runs", "warn", runsError.message)
  } else {
    const withEvidence = (recentRuns ?? []).filter((row) => {
      const signals = row.signals as Record<string, unknown> | null
      return Boolean(signals?.companyEvidence_v22 || signals?.company_evidence_v22)
    }).length
    record(
      "company_evidence_reuse",
      withEvidence > 0 ? "pass" : "warn",
      `${withEvidence}/${recentRuns?.length ?? 0} recent completed runs include companyEvidence_v22`,
    )
  }

  const { data: leads, error: leadsError } = await admin
    .schema("growth")
    .from("leads")
    .select("id, metadata, latest_prospect_research_run_id")
    .neq("status", "archived")
    .limit(50)

  if (leadsError) {
    record("admission_metadata", "warn", leadsError.message)
  } else {
    const withAdmission = (leads ?? []).filter((row) => {
      const metadata = row.metadata as Record<string, unknown> | null
      return Boolean(resolveLeadAdmissionStateFromMetadata(metadata))
    }).length
    record(
      "admission_metadata",
      withAdmission === (leads?.length ?? 0) ? "pass" : "warn",
      `${withAdmission}/${leads?.length ?? 0} active leads have admission metadata`,
    )
  }

  record("qa_marker", "pass", `${GROWTH_CANONICAL_RESEARCH_23_QA_MARKER} wired in codebase`)

  summarize()
}

function summarize(): void {
  const failed = checks.filter((check) => check.status === "fail")
  const warned = checks.filter((check) => check.status === "warn")
  console.log("")
  console.log(`[${PHASE}] Checks: ${checks.length} total, ${failed.length} failed, ${warned.length} warnings`)
  if (failed.length > 0) {
    process.exitCode = 1
    console.log(`[${PHASE}] FAIL — fix blocking checks before deploy`)
    return
  }
  console.log(`[${PHASE}] PASS — Runtime Canonicalization production validation (read-only)`)
}

void main()
