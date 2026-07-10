/**
 * GE-AIOS-LIVE-1B — Apply Equipify equipment-service Company Profile to production (operator-approved).
 *
 * Dry-run (default):
 *   pnpm apply:ge-aios-live-1b-equipify-production-company-profile
 *
 * Write to production (requires explicit flag):
 *   pnpm apply:ge-aios-live-1b-equipify-production-company-profile -- --apply
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  approveBusinessProfileForOrganization,
  fetchBusinessProfileWorkspaceState,
} from "@/lib/growth/business-profile/business-profile-service"
import { insertBusinessProfileDraft } from "@/lib/growth/business-profile/business-profile-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  buildLive1bEquipifyCompanyProfileContent,
  EQUIPIFY_PRODUCTION_ORG_ID,
  GE_AIOS_LIVE_1B_QA_MARKER,
  LIVE_1B_EQUIPIFY_COMPANY_INPUT,
  LIVE_1B_EQUIPIFY_MISSION_TITLE,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { listGrowthObjectives, updateGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"

const PHASE = "GE-AIOS-LIVE-1B" as const

function wantsApply(argv: string[]): boolean {
  return argv.includes("--apply")
}

function manufacturingFocused(title: string): boolean {
  const lower = title.toLowerCase()
  return /manufactur/.test(lower) && !/maintain|service|technician|repair|equipment/.test(lower)
}

async function main(): Promise<void> {
  const apply = wantsApply(process.argv)
  console.log(`[${PHASE}] Equipify production Company Profile update`)
  console.log(`QA marker: ${GE_AIOS_LIVE_1B_QA_MARKER}`)
  console.log(`Mode: ${apply ? "APPLY (writes)" : "DRY-RUN (read-only preview)"}`)

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

  const before = await fetchBusinessProfileWorkspaceState(admin, organizationId)
  const objectives = await listGrowthObjectives(admin, organizationId)
  const activeObjective = objectives.find(
    (row) => row.status === "active" && row.runtime?.running && !row.emergencyStopActive,
  )

  const profileContent = buildLive1bEquipifyCompanyProfileContent()

  console.log("\n--- Preview ---")
  console.log(`  Canonical UI (future edits): /growth/training/company-profile`)
  console.log(`  Storage: growth.organization_business_profiles`)
  console.log(`  Current approved profile: ${before.activeApproved?.id ?? "(none)"}`)
  console.log(`  Target industries count: ${profileContent.idealCustomers.targetIndustries.length}`)
  console.log(
    `  preferredNaicsCodes: ${(profileContent.idealCustomers.preferredNaicsCodes ?? []).join(", ")}`,
  )
  console.log(`  disqualifiers count: ${profileContent.idealCustomers.disqualifiers.length}`)

  if (activeObjective) {
    console.log(`\n--- Active Objective ---`)
    console.log(`  id: ${activeObjective.id}`)
    console.log(`  current title: ${activeObjective.title}`)
    console.log(`  manufacturing-focused: ${manufacturingFocused(activeObjective.title)}`)
    console.log(`  proposed title: ${LIVE_1B_EQUIPIFY_MISSION_TITLE}`)
  } else {
    console.log("\n--- Active Objective ---")
    console.log("  (none running — mission title update skipped)")
  }

  if (!apply) {
    console.log("\n--- Dry Run Complete ---")
    console.log("  Re-run with --apply to create draft, approve profile, and update mission title.")
    process.exit(0)
  }

  if (!before.schemaReady) {
    console.error("Business Profile schema not ready — apply migration first.")
    process.exit(1)
  }

  const draft = await insertBusinessProfileDraft(admin, {
    organizationId,
    companyName: LIVE_1B_EQUIPIFY_COMPANY_INPUT.companyName,
    website: LIVE_1B_EQUIPIFY_COMPANY_INPUT.website,
    profile: profileContent,
    draftInput: LIVE_1B_EQUIPIFY_COMPANY_INPUT,
    createdBy: null,
  })

  if (!draft) {
    console.error("Failed to insert profile draft.")
    process.exit(1)
  }

  const approved = await approveBusinessProfileForOrganization(admin, {
    organizationId,
    profileId: draft.id,
    approvedBy: null,
  })

  console.log("\n--- Profile Applied ---")
  console.log(`  profileId: ${approved.id}`)
  console.log(`  status: ${approved.status}`)
  console.log(`  approvedAt: ${approved.approvedAt}`)

  if (activeObjective && activeObjective.title.trim() !== LIVE_1B_EQUIPIFY_MISSION_TITLE) {
    const updated = await updateGrowthObjective(admin, organizationId, activeObjective.id, {
      title: LIVE_1B_EQUIPIFY_MISSION_TITLE,
    })
    console.log("\n--- Mission Updated ---")
    console.log(`  objectiveId: ${updated.id}`)
    console.log(`  title: ${updated.title}`)
  }

  console.log(`\n[${PHASE}] APPLY complete — run validation scripts next.`)
}

void main()
