/**
 * GE-AIOS-LIVE-1B — Inspect production Company Profile + mission state (read-only).
 *
 *   pnpm inspect:ge-aios-live-1b-production-profile-state
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchBusinessProfileWorkspaceState } from "@/lib/growth/business-profile/business-profile-service"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  EQUIPIFY_PRODUCTION_ORG_ID,
  GE_AIOS_LIVE_1B_QA_MARKER,
  LIVE_1B_EQUIPIFY_MISSION_TITLE,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { summarizeGrowthLeadAdmissionDeploymentStatus } from "@/lib/growth/revenue-workflow/growth-lead-admission-deployment-messaging"
import { analyzeGrowthLeadAdmissionProductionPool } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"

const PHASE = "GE-AIOS-LIVE-1B" as const

function resolveActiveObjective(
  objectives: Awaited<ReturnType<typeof listGrowthObjectives>>,
) {
  return objectives.find(
    (row) => row.status === "active" && row.runtime?.running && !row.emergencyStopActive,
  )
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production profile + mission inspect (read-only)`)
  console.log(`QA marker: ${GE_AIOS_LIVE_1B_QA_MARKER}`)
  console.log(`Organization: ${EQUIPIFY_PRODUCTION_ORG_ID}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const admin: SupabaseClient = bootstrap.admin
  const organizationId = EQUIPIFY_PRODUCTION_ORG_ID

  const workspace = await fetchBusinessProfileWorkspaceState(admin, organizationId)
  console.log("\n--- Company Profile Workspace ---")
  console.log(`  schemaReady: ${workspace.schemaReady}`)
  console.log(`  canonical UI route: /growth/training/company-profile`)
  console.log(`  storage: growth.organization_business_profiles`)

  if (workspace.activeApproved) {
    const p = workspace.activeApproved
    console.log("\n--- Active Approved Profile ---")
    console.log(`  id: ${p.id}`)
    console.log(`  status: ${p.status}`)
    console.log(`  approvedAt: ${p.approvedAt}`)
    console.log(`  approvedBy: ${p.approvedBy ?? "(service)"}`)
    console.log(`  companyName: ${p.companyName}`)
    console.log(`  targetIndustries (first 5): ${p.profile.idealCustomers.targetIndustries.slice(0, 5).join("; ")}`)
    console.log(
      `  preferredNaicsCodes: ${(p.profile.idealCustomers.preferredNaicsCodes ?? []).join(", ") || "(none)"}`,
    )
  } else {
    console.log("\n--- Active Approved Profile ---")
    console.log("  (none — approved_profile gate will fail)")
  }

  if (workspace.latestDraft) {
    console.log(`\n--- Latest Draft ---`)
    console.log(`  id: ${workspace.latestDraft.id}`)
    console.log(`  status: ${workspace.latestDraft.status}`)
  }

  const objectives = await listGrowthObjectives(admin, organizationId)
  const active = resolveActiveObjective(objectives)
  console.log("\n--- Active Mission / Objective ---")
  if (active) {
    console.log(`  id: ${active.id}`)
    console.log(`  title: ${active.title}`)
    console.log(`  matches LIVE-1B target: ${active.title.trim() === LIVE_1B_EQUIPIFY_MISSION_TITLE}`)
  } else {
    console.log("  (no active running objective)")
  }

  const admission = await analyzeGrowthLeadAdmissionProductionPool({ admin, organizationId })
  const deployStatus = summarizeGrowthLeadAdmissionDeploymentStatus(admission)
  console.log("\n--- Admission Context ---")
  console.log(`  approved profile loaded for 21C: ${Boolean(workspace.activeApproved)}`)
  console.log(`  deploymentActive: ${deployStatus.deploymentActive}`)
}

void main()
