/**
 * AVA-HOME-AI-TEAMMATE-500-HOTFIX-1A — read-only production probe (temp).
 */
import { execSync } from "node:child_process"
import { loadGrowthAiTeammateIdentityRecord } from "@/lib/growth/settings/growth-ai-teammate-identity-repository"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"

async function main(): Promise<void> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error("bootstrap failed")
    process.exit(1)
  }

  const orgRow = await boot.admin
    .schema("growth")
    .from("organization_ai_teammate_identity")
    .select("organization_id")
    .limit(1)
    .maybeSingle()
  console.log("org_row_probe", {
    error: orgRow.error ? { message: orgRow.error.message, code: orgRow.error.code } : null,
    organizationId: orgRow.data?.organization_id ?? null,
  })

  const orgId =
    getGrowthEngineAiOrgId() ??
    process.env.GROWTH_ENGINE_AI_ORG_ID ??
    orgRow.data?.organization_id ??
    null
  console.log("orgId", orgId)

  const ORG_SELECT =
    "organization_id, teammate_name, updated_by_user_id, qa_marker, created_at, updated_at, autonomous_activated_at, autonomous_activated_by_user_id"
  const { data, error } = await boot.admin
    .schema("growth")
    .from("organization_ai_teammate_identity")
    .select(ORG_SELECT)
    .eq("organization_id", orgId)
    .maybeSingle()
  console.log("direct_query", {
    error: error
      ? { message: error.message, code: error.code, details: error.details, hint: error.hint }
      : null,
    hasData: Boolean(data),
  })

  const prefs = await boot.admin
    .schema("growth")
    .from("operator_workspace_preferences")
    .select("ai_teammate_onboarding_completed")
    .limit(1)
  console.log("onboarding_column_probe", {
    error: prefs.error ? { message: prefs.error.message, code: prefs.error.code } : null,
  })

  const userId =
    (await boot.admin.auth.admin.listUsers({ page: 1, perPage: 1 })).data.users?.[0]?.id ??
    "00000000-0000-0000-0000-000000000000"

  try {
    const identity = await loadGrowthAiTeammateIdentityRecord(boot.admin, {
      organizationId: orgId || orgRow.data?.organization_id || null,
      userId,
    })
    console.log("loadGrowthAiTeammateIdentityRecord_ok", {
      source: identity.source,
      name: identity.name,
      onboardingCompleted: identity.onboardingCompleted,
    })
  } catch (e) {
    console.log("loadGrowthAiTeammateIdentityRecord_error", e instanceof Error ? e.message : String(e))
  }

  const projectRef = boot.url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) throw new Error("no project ref")
  const anon = (
    JSON.parse(
      execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, { encoding: "utf8" }),
    ) as Array<{ name: string; api_key: string }>
  ).find((entry) => entry.name === "anon")?.api_key
  if (!anon) throw new Error("no anon key")

  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anon,
    admin_email: "mike@blitzind.com",
  })
  if (!minted.access_token) {
    console.error("mint failed", minted.error)
    process.exit(1)
  }

  const t0 = Date.now()
  const res = await fetch("https://app.equipify.ai/api/growth/workspace/settings/ai-teammate", {
    headers: { Authorization: `Bearer ${minted.access_token}`, Accept: "application/json" },
  })
  const bodyText = await res.text()
  console.log("production_api", {
    status: res.status,
    durationMs: Date.now() - t0,
    body: bodyText.slice(0, 800),
  })

  const t1 = Date.now()
  const summaryRes = await fetch("https://app.equipify.ai/api/platform/growth/home/workspace-summary", {
    headers: { Authorization: `Bearer ${minted.access_token}`, Accept: "application/json" },
  })
  const summaryText = await summaryRes.text()
  let summaryJson: Record<string, unknown> | null = null
  try {
    summaryJson = JSON.parse(summaryText) as Record<string, unknown>
  } catch {
    summaryJson = null
  }
  console.log("production_workspace_summary", {
    status: summaryRes.status,
    durationMs: Date.now() - t1,
    bodyBytes: summaryText.length,
    ok: summaryJson?.ok === true,
    optimization: summaryJson?.optimization ?? null,
    stageTimings: summaryJson?.stageTimings ?? null,
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
