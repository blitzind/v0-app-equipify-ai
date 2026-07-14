/**
 * GE-AIOS-PRODUCTION-VALIDATION-1B — Read-only production organization mapping.
 *
 * Run:
 *   pnpm resolve:ge-aios-production-organization-1b
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { EQUIPIFY_MASTER_KNOWLEDGE_PRODUCTION_ORG_ID } from "@/lib/growth/business-profile/equipify-master-knowledge-production-apply"
import { PRECISION_BIOMEDICAL_AI_OS_ORG_ID } from "@/lib/growth/reset/growth-engine-operational-reset-constants"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

export const GE_AIOS_PRODUCTION_ORGANIZATION_1B_QA_MARKER =
  "ge-aios-production-organization-1b-v1" as const

const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const CANDIDATE_ORGS = [
  { id: EQUIPIFY_PRODUCTION_ORG_ID, label: "equipify_production_live_1b" },
  { id: EQUIPIFY_MASTER_KNOWLEDGE_PRODUCTION_ORG_ID, label: "equipify_master_knowledge_apply" },
  { id: PRECISION_BIOMEDICAL_AI_OS_ORG_ID, label: "precision_biomedical_ai_os_test" },
] as const

async function countRows(
  admin: ReturnType<typeof createClient>,
  table: string,
  organizationId: string,
): Promise<number | null> {
  const { count, error } = await admin
    .schema("growth")
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
  if (error) return null
  return count ?? 0
}

async function main(): Promise<void> {
  console.log(`[GE-AIOS-PRODUCTION-ORGANIZATION-1B] ${GE_AIOS_PRODUCTION_ORGANIZATION_1B_QA_MARKER}`)

  bootstrapGrowthOperatorNotificationsCertEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log(JSON.stringify({ ok: false, error: "supabase_env_missing" }))
    process.exitCode = 1
    return
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const growthEngineAiOrgId = getGrowthEngineAiOrgId()

  const lead = await fetchGrowthLeadById(admin, BLOCK_LEAD)
  const mapping: Record<string, string | null> = {
    growth_engine_ai_org_id_env: growthEngineAiOrgId,
    block_imaging_lead_promoted_org: lead?.promotedOrganizationId ?? null,
    block_imaging_lead_company: lead?.companyName ?? null,
    block_imaging_lead_status: lead?.status ?? null,
  }

  const orgProfiles: Array<Record<string, unknown>> = []
  for (const org of CANDIDATE_ORGS) {
    const [approvedProfile, pilotRuns, draftFactory] = await Promise.all([
      admin
        .schema("growth")
        .from("organization_business_profiles")
        .select("id, status, company_name, approved_at, updated_at")
        .eq("organization_id", org.id)
        .eq("status", "approved")
        .order("approved_at", { ascending: false })
        .limit(1),
      admin
        .schema("growth")
        .from("autonomous_outreach_preparation_runs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("lead_id", BLOCK_LEAD),
      countRows(admin, "draft_factory_lead_states", org.id),
    ])

    orgProfiles.push({
      organization_id: org.id,
      label: org.label,
      approved_business_profile: approvedProfile.data?.[0] ?? null,
      block_imaging_pilot_runs: pilotRuns.count ?? 0,
      draft_factory_state_rows: draftFactory,
      outreach_pilot_runs_total: await countRows(
        admin,
        "autonomous_outreach_preparation_runs",
        org.id,
      ),
    })
  }

  const liveOrg =
    orgProfiles.find((row) => row.approved_business_profile != null && row.label === "equipify_production_live_1b") ??
    null

  console.log(
    JSON.stringify(
      {
        ok: true,
        qaMarker: GE_AIOS_PRODUCTION_ORGANIZATION_1B_QA_MARKER,
        mapping: {
          block_imaging_lead: BLOCK_LEAD,
          block_imaging_lead_org: mapping.block_imaging_lead_promoted_org,
          approved_equipify_business_profile_org:
            (liveOrg?.organization_id as string | undefined) ?? EQUIPIFY_PRODUCTION_ORG_ID,
          draft_factory_org:
            orgProfiles.find((row) => (row.draft_factory_state_rows as number) > 0)?.organization_id ??
            null,
          growth_5f_preparation_org:
            orgProfiles.find((row) => (row.outreach_pilot_runs_total as number) > 0)?.organization_id ??
            null,
          ai_os_operator_workspace_org:
            growthEngineAiOrgId ?? "REQUIRES_GROWTH_ENGINE_AI_ORG_ID_ON_VERCEL_PRODUCTION",
          objective_runtime_scheduler_org:
            growthEngineAiOrgId ?? "REQUIRES_GROWTH_ENGINE_AI_ORG_ID_ON_VERCEL_PRODUCTION",
        },
        growth_engine_ai_org_id_env: growthEngineAiOrgId,
        block_imaging: mapping,
        organization_profiles: orgProfiles,
        verdict:
          growthEngineAiOrgId === EQUIPIFY_PRODUCTION_ORG_ID
            ? "env_matches_documented_production_org"
            : growthEngineAiOrgId
              ? "env_set_non_documented_org"
              : "env_unset_requires_vercel_production_configuration",
        recommended_vercel_production_env: growthEngineAiOrgId
          ? null
          : {
              GROWTH_ENGINE_AI_ORG_ID: EQUIPIFY_PRODUCTION_ORG_ID,
              reason:
                "Documented Equipify AI OS production workspace (Live 1B). 5876176a is legacy test/master-knowledge apply org.",
            },
      },
      null,
      2,
    ),
  )
}

void main()
