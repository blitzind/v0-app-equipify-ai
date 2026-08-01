/**
 * AVA RUNTIME SHUTDOWN — Phase 1 production proof (read-only).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/probe-ava-runtime-shutdown-phase1-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { isGrowthTransportSimulationEnabled } from "@/lib/growth/runtime/runtime-guards"
import { isLiveDnsVerificationEnabled } from "@/lib/growth/deliverability/live-dns-verifier"

const AVA_SHUTDOWN_ROUTES = [
  "/api/cron/growth-objective-runtime-scheduler",
  "/api/cron/growth-acquisition-worker",
  "/api/cron/growth-sequence-scheduler",
  "/api/cron/growth-sequence-safe-execute",
  "/api/cron/growth-inbox-sync",
  "/api/cron/growth-signal-ingest",
  "/api/cron/growth-discovery-worker",
  "/api/cron/growth-email-discovery-worker",
  "/api/cron/growth-phone-discovery-worker",
  "/api/cron/growth-social-profile-discovery-worker",
  "/api/cron/growth-company-intelligence-worker",
  "/api/cron/growth-buying-committee-intelligence-worker",
  "/api/cron/growth-company-signal-refresh",
  "/api/cron/growth-contact-refresh",
  "/api/cron/growth-prospect-graph-expansion-worker",
  "/api/cron/growth-territory-refresh",
  "/api/cron/growth-market-health-refresh",
  "/api/cron/growth-sequence-recovery",
  "/api/cron/growth-sequence-wait-timeouts",
  "/api/cron/growth-lifecycle-maintenance",
  "/api/cron/growth-provider-runtime-diagnostics",
  "/api/cron/growth-pdl-test-lookup-run",
  "/api/cron/growth-pdl-coverage-audit-run",
  "/api/cron/growth-pdl-benchmark-validation-run",
  "/api/cron/growth-email-discovery-cert-run",
] as const

const WARMUP_ROUTES = [
  "/api/cron/growth-warmup-progression",
  "/api/cron/growth-warmup-send-executor",
  "/api/cron/growth-dns-verify",
  "/api/cron/growth-reputation-snapshot",
  "/api/cron/growth-event-retention",
] as const

function supabaseHostFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return "(unparseable)"
  }
}

async function main(): Promise<void> {
  const projectRef = resolveLinkedSupabaseProjectRef()
  if (!projectRef) throw new Error("linked_supabase_project_ref_missing")
  const jwt = fetchSupabaseServiceRoleKeyFromCli(projectRef)
  if (!jwt) throw new Error("supabase_service_role_key_unavailable")
  const supabaseUrl = resolveSupabaseUrlForProjectRef(projectRef)
  const admin = createClient(supabaseUrl, jwt, { auth: { persistSession: false, autoRefreshToken: false } })
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    killSwitches,
    digestSettings,
    digestRuns,
    warmupProfiles,
    warmupProgressionRuns,
    warmupExecutorRuns,
    warmupDeliveryAttempts,
    reputationSnapshots,
    domainHealthSnapshots,
    avaCronRuns24h,
    warmupCronRuns24h,
    datamoonRuns24h,
  ] = await Promise.all([
    getRuntimeKillSwitchStates(admin),
    admin.from("ai_ops_digest_settings").select("organization_id, enabled, recipients, last_sent_at").eq("enabled", true),
    admin
      .from("ai_ops_digest_runs")
      .select("id, organization_id, trigger_kind, status, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(20),
    admin.schema("growth").from("warmup_profiles").select("id, status, current_day, organization_id, updated_at").limit(20),
    admin
      .schema("growth")
      .from("cron_execution_runs")
      .select("id, cron_route, started_at, ok, metrics")
      .eq("cron_route", "/api/cron/growth-warmup-progression")
      .gte("started_at", since7d)
      .order("started_at", { ascending: false })
      .limit(5),
    admin
      .schema("growth")
      .from("cron_execution_runs")
      .select("id, cron_route, started_at, ok, metrics")
      .eq("cron_route", "/api/cron/growth-warmup-send-executor")
      .gte("started_at", since7d)
      .order("started_at", { ascending: false })
      .limit(5),
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id, status, created_at, channel")
      .eq("channel", "email")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .schema("growth")
      .from("reputation_snapshots")
      .select("id, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .schema("growth")
      .from("domain_health_snapshots")
      .select("id, created_at")
      .gte("created_at", since7d)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .schema("growth")
      .from("cron_execution_runs")
      .select("cron_route, started_at, ok")
      .in("cron_route", [...AVA_SHUTDOWN_ROUTES])
      .gte("started_at", since24h),
    admin
      .schema("growth")
      .from("cron_execution_runs")
      .select("cron_route, started_at, ok")
      .in("cron_route", [...WARMUP_ROUTES])
      .gte("started_at", since24h),
    admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select("id, run_name, status, created_at")
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const avaCronCounts: Record<string, number> = {}
  for (const row of avaCronRuns24h.data ?? []) {
    const route = String(row.cron_route)
    avaCronCounts[route] = (avaCronCounts[route] ?? 0) + 1
  }

  const warmupCronCounts: Record<string, number> = {}
  for (const row of warmupCronRuns24h.data ?? []) {
    const route = String(row.cron_route)
    warmupCronCounts[route] = (warmupCronCounts[route] ?? 0) + 1
  }

  const supabaseHost = supabaseHostFromUrl(supabaseUrl)

  console.log(
    JSON.stringify(
      {
        phase: "AVA_RUNTIME_SHUTDOWN_PHASE1_PRODUCTION_PROOF",
        targets: {
          supabaseProjectName: "equipify-ai",
          supabaseProjectRef: projectRef,
          supabaseApiHostname: supabaseHost,
          databaseHostname: "aws-1-us-east-2.pooler.supabase.com",
        },
        killSwitches: {
          autonomy_enabled: killSwitches.autonomy_enabled,
          autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
          autonomy_objective_mode_enabled: killSwitches.autonomy_objective_mode_enabled,
        },
        dnsVerification: {
          GROWTH_LIVE_DNS_VERIFICATION: isLiveDnsVerificationEnabled(),
          mode: isLiveDnsVerificationEnabled() ? "live_dns_probes" : "snapshot_only_refresh",
        },
        transportSimulation: {
          GROWTH_TRANSPORT_SIMULATE: isGrowthTransportSimulationEnabled(),
        },
        aiOpsDigest: {
          enabledOrganizations: (digestSettings.data ?? []).length,
          enabledOrgIds: (digestSettings.data ?? []).map((r) => r.organization_id),
          recentRuns7d: (digestRuns.data ?? []).length,
          lastRuns: (digestRuns.data ?? []).slice(0, 5).map((r) => ({
            id: r.id,
            orgId: r.organization_id,
            trigger: r.trigger_kind,
            status: r.status,
            createdAt: r.created_at,
          })),
        },
        warmup: {
          profileCount: (warmupProfiles.data ?? []).length,
          profiles: (warmupProfiles.data ?? []).map((p) => ({
            id: p.id,
            status: p.status,
            currentDay: p.current_day,
            updatedAt: p.updated_at,
          })),
          progressionRuns7d: (warmupProgressionRuns.data ?? []).length,
          lastProgressionRuns: warmupProgressionRuns.data ?? [],
          executorRuns7d: (warmupExecutorRuns.data ?? []).length,
          lastExecutorRuns: warmupExecutorRuns.data ?? [],
          recentDeliveryAttempts7d: (warmupDeliveryAttempts.data ?? []).length,
          reputationSnapshots7d: (reputationSnapshots.data ?? []).length,
          domainHealthSnapshots7d: (domainHealthSnapshots.data ?? []).length,
          warmupCronRuns24h: warmupCronCounts,
        },
        avaCronActivity24h: {
          totalRuns: (avaCronRuns24h.data ?? []).length,
          byRoute: avaCronCounts,
        },
        datamoonRuns24h: (datamoonRuns24h.data ?? []).length,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
