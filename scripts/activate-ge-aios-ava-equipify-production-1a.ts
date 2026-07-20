/**
 * GE-AIOS-AVA-EQUIPIFY-TRAINING-AND-PRODUCTION-ACTIVATION-1A — Idempotent Production activation runner.
 *
 * Dry-run (default):
 *   pnpm activate:ava:equipify:production
 *
 * Apply (requires confirmation token):
 *   CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A=1 pnpm activate:ava:equipify:production -- --apply
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  approveBusinessProfileForOrganization,
  fetchBusinessProfileWorkspaceState,
} from "@/lib/growth/business-profile/business-profile-service"
import { insertBusinessProfileDraft } from "@/lib/growth/business-profile/business-profile-repository"
import {
  computeMasterKnowledgeContentFingerprint,
  isProductionEnrichmentIdempotent,
} from "@/lib/growth/business-profile/equipify-master-knowledge-production-apply"
import { enrichBusinessProfileWithEquipifyMasterKnowledge } from "@/lib/growth/business-profile/equipify-master-knowledge-merge"
import { mergePortfolioManagementSection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a"
import { SUPPORTED_SERVICE_VERTICALS_REGISTRY } from "@/lib/growth/business-profile/supported-service-verticals"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  buildLive1bEquipifyCompanyProfileContent,
  EQUIPIFY_PRODUCTION_ORG_ID,
  LIVE_1B_EQUIPIFY_COMPANY_INPUT,
  LIVE_1B_EQUIPIFY_MISSION_TITLE,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { upsertOrganizationAiTeammateIdentity } from "@/lib/growth/settings/growth-ai-teammate-identity-repository"
import { getRuntimeKillSwitchStates, setRuntimeKillSwitch } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { listGrowthObjectives, updateGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"

export const GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A_QA_MARKER =
  "ge-aios-ava-equipify-training-production-activation-1a-v1" as const

export const CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A =
  "CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A" as const

const PREFERRED_AI_TEAMMATE_NAME = "Ava Sinclair" as const

const REQUIRED_US_GEOGRAPHY = ["United States"] as const

function wantsApply(argv: string[]): boolean {
  return argv.includes("--apply")
}

function hasConfirmationToken(): boolean {
  return process.env[CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A] === "1"
}

function buildExplicitSupportedServiceVerticalRefs() {
  return SUPPORTED_SERVICE_VERTICALS_REGISTRY.map((vertical) => ({
    id: vertical.id,
    label: vertical.label,
  }))
}

function profileNeedsExplicitVerticals(profile: ReturnType<typeof buildLive1bEquipifyCompanyProfileContent>) {
  const current = profile.idealCustomers.supportedServiceVerticals?.length ?? 0
  return current < SUPPORTED_SERVICE_VERTICALS_REGISTRY.length
}

function profileNeedsUsOnlyGeography(profile: ReturnType<typeof buildLive1bEquipifyCompanyProfileContent>) {
  const geo = profile.idealCustomers.geography.map((entry) => entry.trim().toLowerCase())
  return geo.includes("canada") || !geo.includes("united states")
}

async function ensureKillSwitches(admin: SupabaseClient, apply: boolean) {
  const before = await getRuntimeKillSwitchStates(admin)
  const desired = {
    autonomy_enabled: true,
    autonomy_outbound_enabled: false,
  }
  const changes: string[] = []
  if (before.autonomy_enabled !== desired.autonomy_enabled) {
    changes.push(`autonomy_enabled: ${before.autonomy_enabled} → ${desired.autonomy_enabled}`)
    if (apply) {
      await setRuntimeKillSwitch(admin, { key: "autonomy_enabled", enabled: desired.autonomy_enabled })
    }
  }
  if (before.autonomy_outbound_enabled !== desired.autonomy_outbound_enabled) {
    changes.push(
      `autonomy_outbound_enabled: ${before.autonomy_outbound_enabled} → ${desired.autonomy_outbound_enabled}`,
    )
    if (apply) {
      await setRuntimeKillSwitch(admin, {
        key: "autonomy_outbound_enabled",
        enabled: desired.autonomy_outbound_enabled,
      })
    }
  }
  const after = apply ? await getRuntimeKillSwitchStates(admin) : before
  return { before, after, changes }
}

async function main(): Promise<void> {
  const apply = wantsApply(process.argv)
  const confirmed = hasConfirmationToken()
  console.log(`[${GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A_QA_MARKER}] Equipify Ava activation runner`)
  console.log(`Organization: ${EQUIPIFY_PRODUCTION_ORG_ID}`)
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`)

  if (apply && !confirmed) {
    console.error(
      `Missing confirmation token. Set ${CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A}=1 to apply.`,
    )
    process.exit(1)
  }

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const admin = bootstrap.admin
  const organizationId = EQUIPIFY_PRODUCTION_ORG_ID

  const beforeWorkspace = await fetchBusinessProfileWorkspaceState(admin, organizationId)
  const beforeProfile = beforeWorkspace.activeApproved?.profile ?? null
  const targetProfile = buildLive1bEquipifyCompanyProfileContent()
  const patchedProfile = {
    ...targetProfile,
    idealCustomers: {
      ...targetProfile.idealCustomers,
      supportedServiceVerticals: buildExplicitSupportedServiceVerticalRefs(),
      geography: [...REQUIRED_US_GEOGRAPHY],
    },
    portfolioManagement: mergePortfolioManagementSection(
      beforeProfile?.portfolioManagement,
      targetProfile.portfolioManagement ?? {},
    ),
  }
  const proposedProfile = enrichBusinessProfileWithEquipifyMasterKnowledge(patchedProfile)

  const enrichmentIdempotent = beforeProfile
    ? isProductionEnrichmentIdempotent(beforeProfile, proposedProfile)
    : false

  const proposedActions: string[] = []
  const blockedActions: string[] = []

  if (!beforeWorkspace.activeApproved) {
    proposedActions.push("Create and approve Business Profile from LIVE-1B fixture + master knowledge.")
  } else if (!enrichmentIdempotent) {
    proposedActions.push("Upsert approved Business Profile draft (explicit SSV refs, US geography, portfolio targets).")
  } else {
    proposedActions.push("Business Profile enrichment already idempotent — skip profile rewrite.")
  }

  if (profileNeedsExplicitVerticals(beforeProfile ?? targetProfile)) {
    proposedActions.push(`Persist ${SUPPORTED_SERVICE_VERTICALS_REGISTRY.length} explicit Supported Service Vertical refs.`)
  }

  if (profileNeedsUsOnlyGeography(beforeProfile ?? targetProfile)) {
    proposedActions.push("Set geography to United States only (remove Canada unless operator rejects).")
  }

  proposedActions.push(`Ensure AI teammate name '${PREFERRED_AI_TEAMMATE_NAME}' in organization_ai_teammate_identity.`)
  proposedActions.push("Ensure autonomy_enabled=true and autonomy_outbound_enabled=false.")
  proposedActions.push("Ensure active mission title matches LIVE-1B equipment-service mission.")

  blockedActions.push(
    "Pricing conflict: equipify.ai/pricing publishes tier pricing; canonical seller knowledge limits outreach pricing claims — operator must reconcile businessStrategy.pricingPhilosophy before outbound.",
  )
  blockedActions.push(
    "Product naming conflict: public site uses Core/Growth/Scale tiers; canonical product architecture uses Equipify Operations — operator must approve messaging bridge before sales conversations.",
  )
  blockedActions.push("Outbound sending remains disabled — no transport actions in this runner.")

  console.log("\n--- Proposed Actions ---")
  for (const action of proposedActions) console.log(`  • ${action}`)
  console.log("\n--- Operator Review Required (not auto-applied) ---")
  for (const action of blockedActions) console.log(`  • ${action}`)

  const killSwitchPlan = await ensureKillSwitches(admin, false)
  console.log("\n--- Kill Switches (before) ---")
  console.log(JSON.stringify(killSwitchPlan.before, null, 2))
  if (killSwitchPlan.changes.length > 0) {
    console.log("Planned kill-switch changes:")
    for (const change of killSwitchPlan.changes) console.log(`  • ${change}`)
  }

  if (!apply) {
    console.log("\n--- Dry Run Complete ---")
    console.log(
      `Re-run with ${CONFIRM_GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A}=1 pnpm activate:ava:equipify:production -- --apply`,
    )
    process.exit(0)
  }

  let profileId = beforeWorkspace.activeApproved?.id ?? null
  if (!beforeWorkspace.activeApproved || !enrichmentIdempotent) {
    const draft = await insertBusinessProfileDraft(admin, {
      organizationId,
      companyName: LIVE_1B_EQUIPIFY_COMPANY_INPUT.companyName,
      website: LIVE_1B_EQUIPIFY_COMPANY_INPUT.website,
      profile: proposedProfile,
      draftInput: LIVE_1B_EQUIPIFY_COMPANY_INPUT,
      createdBy: null,
    })
    if (!draft) throw new Error("Failed to insert profile draft")
    const approved = await approveBusinessProfileForOrganization(admin, {
      organizationId,
      profileId: draft.id,
      approvedBy: null,
    })
    profileId = approved.id
    console.log(`\nApplied profile ${profileId}`)
  }

  const objectives = await listGrowthObjectives(admin, organizationId)
  const activeObjective = objectives.find(
    (row) => row.status === "active" && row.runtime?.running && !row.emergencyStopActive,
  )
  if (activeObjective && activeObjective.title.trim() !== LIVE_1B_EQUIPIFY_MISSION_TITLE) {
    await updateGrowthObjective(admin, organizationId, activeObjective.id, {
      title: LIVE_1B_EQUIPIFY_MISSION_TITLE,
    })
    console.log(`Updated mission title on objective ${activeObjective.id}`)
  }

  await upsertOrganizationAiTeammateIdentity(admin, {
    organizationId,
    teammateName: PREFERRED_AI_TEAMMATE_NAME,
    updatedByUserId: organizationId,
  })
  console.log(`Upserted AI teammate identity '${PREFERRED_AI_TEAMMATE_NAME}'`)

  const killAfter = await ensureKillSwitches(admin, true)
  console.log("\n--- Kill Switches (after) ---")
  console.log(JSON.stringify(killAfter.after, null, 2))

  const afterWorkspace = await fetchBusinessProfileWorkspaceState(admin, organizationId)
  const fingerprint = afterWorkspace.activeApproved?.profile
    ? computeMasterKnowledgeContentFingerprint(afterWorkspace.activeApproved.profile)
    : null

  console.log("\n--- Activation Report ---")
  console.log(
    JSON.stringify(
      {
        qaMarker: GE_AIOS_AVA_EQUIPIFY_PRODUCTION_ACTIVATION_1A_QA_MARKER,
        organizationId,
        profileId: afterWorkspace.activeApproved?.id ?? profileId,
        masterKnowledgeFingerprint: fingerprint,
        explicitSSV:
          afterWorkspace.activeApproved?.profile.idealCustomers.supportedServiceVerticals?.length ?? 0,
        geography: afterWorkspace.activeApproved?.profile.idealCustomers.geography ?? [],
        killSwitches: killAfter.after,
        outboundDisabled: killAfter.after.autonomy_outbound_enabled === false,
        operatorReviewStillRequired: blockedActions,
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
