/**
 * GE-AIOS-6D — Post-deploy live API smoke for Ava Research Queue.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/smoke-ge-aios-6d-live-research-queue-api.ts
 */
import { execSync } from "node:child_process"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_AVA_RESEARCH_QUEUE_API_PATH } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-api-contract"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveGrowthDeployedRuntimeBaseUrl } from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"
import { resolveLinkedSupabaseProjectRef } from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"

const ACTOR_USER_ID = "00000000-0000-0000-0000-000000000001"

function resolveAnonKey(bootUrl: string): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()
  if (fromEnv) return fromEnv
  const projectRef =
    resolveLinkedSupabaseProjectRef() ?? bootUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) throw new Error("no_project_ref")
  const raw = execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, {
    encoding: "utf8",
  })
  const anon = (JSON.parse(raw) as Array<{ name: string; api_key: string }>).find(
    (entry) => entry.name === "anon",
  )?.api_key
  if (!anon) throw new Error("no_anon_key")
  return anon.trim()
}

async function main(): Promise<void> {
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) throw new Error("bootstrap_failed")

  const baseUrl = resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai"
  const anonKey = resolveAnonKey(boot.url)

  const bearerResult = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anonKey,
    admin_email: "mike@blitzind.com",
  })
  if (!bearerResult.access_token) throw new Error(bearerResult.error ?? "bearer_mint_failed")

  const response = await fetch(`${baseUrl}${GROWTH_AVA_RESEARCH_QUEUE_API_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerResult.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ maxLeads: 1 }),
  })

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  const summary = payload.summary as Record<string, unknown> | null | undefined

  const homeSummary = await buildGrowthHomeWorkspaceSummary({
    admin: boot.admin,
    operatorEmail: "cert@equipify.ai",
    actorUserId: ACTOR_USER_ID,
  })

  console.log(
    JSON.stringify(
      {
        phase: "live_api_smoke",
        base_url: baseUrl,
        http_status: response.status,
        ok: payload.ok ?? false,
        blocked: payload.blocked ?? false,
        transport_blocked: payload.transportBlocked ?? null,
        human_approval_required: payload.humanApprovalRequired ?? null,
        outbound_occurred: payload.outboundOccurred ?? null,
        summary: summary
          ? {
              run_id: summary.runId,
              companies_reviewed: summary.companiesReviewed,
              research_completed: summary.researchCompleted,
              qualification_completed: summary.qualificationCompleted,
              qualification_skipped: summary.qualificationSkipped,
              qualification_failed: summary.qualificationFailed,
              narrative: summary.narrative,
              lead_results: summary.leadResults,
            }
          : null,
        ava_console: {
          research_loop_summary_present: homeSummary.avaConsole.researchLoopSummary != null,
          narrative: homeSummary.avaConsole.researchLoopSummary?.narrative ?? null,
          qualification_skipped: homeSummary.avaConsole.researchLoopSummary?.qualificationSkipped ?? null,
        },
      },
      null,
      2,
    ),
  )

  if (response.status === 404) throw new Error("live_api_still_404")
  if (!response.ok && response.status !== 403) {
    throw new Error(`live_api_failed:${response.status}:${String(payload.message ?? "unknown")}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
