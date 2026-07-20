/** GE-AIOS-AVA-EQUIPIFY-TRAINING-AND-PRODUCTION-ACTIVATION-1A — Read-only Production readiness probe. */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { projectApprovedBusinessProfileToSupportedServiceVerticals } from "@/lib/growth/business-profile/business-profile-supported-service-verticals-projection"
import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import { translateDatamoonOperationalModelTargeting } from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import { getOrganizationAiTeammateIdentity } from "@/lib/growth/settings/growth-ai-teammate-identity-repository"
import { resolvePortfolioTargetFromBusinessProfile } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a"
import { evaluateBusinessStrategyCompleteness } from "@/lib/growth/training/evaluate-business-strategy-completeness"
import { buildOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import { analyzeGrowthLeadAdmissionProductionPool } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  EQUIPIFY_PRODUCTION_ORG_ID,
  LIVE_1B_EQUIPIFY_MISSION_TITLE,
} from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import { SUPPORTED_SERVICE_VERTICALS_REGISTRY } from "@/lib/growth/business-profile/supported-service-verticals"

export const GE_AIOS_AVA_EQUIPIFY_PRODUCTION_READINESS_1A_QA_MARKER =
  "ge-aios-ava-equipify-training-production-readiness-1a-v1" as const

const REQUIRED_VERTICAL_LABELS = [
  "Medical Equipment",
  "HVAC-R",
  "Electrical",
  "Plumbing",
  "Field Service",
  "Garage Door",
  "Locksmith",
  "Property Management",
  "Appliance Repair",
  "Commercial Equipment",
  "Fire & Security",
  "Specialty Contractors",
  "Septic",
  "A/V Installation",
  "MEP",
  "Calibration & Inspection",
  "Commercial HVAC",
  "Commercial Kitchen",
  "Industrial Equipment",
  "Facility Maintenance",
  "Biomedical Equipment",
  "Elevator & Lift",
  "Generator & Power",
  "Equipment Rental",
  "Refrigeration Service",
  "Fleet & Mobile Equipment",
  "Material Handling",
] as const

async function countDatamoonPipeline(admin: SupabaseClient, organizationId: string) {
  const runs = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("id, status, record_count, preview_count, duplicate_count, datamoon_audience_id, created_at")
    .ilike("run_name", "ge-aios-autonomous-prospect-search:%")
    .order("created_at", { ascending: false })
    .limit(5)

  const activeBuilding = (runs.data ?? []).filter((row) => row.status === "building" || row.status === "polling")

  const leads = await admin
    .schema("growth")
    .from("leads")
    .select("id, status, source_channel, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(20)

  const outbound = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("id", { count: "exact", head: true })

  const approvalPackages = await admin
    .schema("growth")
    .from("growth_autonomous_outreach_approval_packages")
    .select("id, status", { count: "exact" })
    .limit(10)

  return {
    recentAutonomousRuns: runs.data ?? [],
    activeBuildingAudienceCount: activeBuilding.length,
    recentLeads: leads.data ?? [],
    leadSampleCount: leads.data?.length ?? 0,
    outboundMessageCount: outbound.count ?? 0,
    approvalPackageSample: approvalPackages.data ?? [],
    approvalPackageCount: approvalPackages.count ?? 0,
  }
}

async function main(): Promise<void> {
  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const admin = bootstrap.admin
  const organizationId = EQUIPIFY_PRODUCTION_ORG_ID

  const [approved, killSwitches, objectives, pipeline] = await Promise.all([
    getActiveApprovedBusinessProfile(admin, organizationId),
    getRuntimeKillSwitchStates(admin),
    listGrowthObjectives(admin, organizationId),
    countDatamoonPipeline(admin, organizationId),
  ])

  let aiTeammate: Awaited<ReturnType<typeof getOrganizationAiTeammateIdentity>> | null = null
  try {
    aiTeammate = await getOrganizationAiTeammateIdentity(admin, organizationId)
  } catch {
    aiTeammate = null
  }

  const admission = await analyzeGrowthLeadAdmissionProductionPool({ admin, organizationId })

  const profile = approved?.profile ?? null
  const ssv = profile
    ? projectApprovedBusinessProfileToSupportedServiceVerticals(profile, approved?.companyName ?? "Equipify")
    : null
  const leadDiscovery = profile
    ? projectApprovedBusinessProfileToLeadDiscovery(profile, approved?.companyName ?? "Equipify")
    : null
  const psFilters = profile ? buildProspectSearchFiltersFromBusinessProfile(profile) : null
  const omt = leadDiscovery
    ? translateDatamoonOperationalModelTargeting({
        projection: leadDiscovery,
        organizationId,
        audienceOrdinal: 0,
      })
    : null
  const portfolio = resolvePortfolioTargetFromBusinessProfile(profile)
  const strategy = evaluateBusinessStrategyCompleteness(profile?.businessStrategy)
  const sellerTruth = profile
    ? buildOutreachSellerTruth({
        profileId: approved!.id,
        profile,
        sellerCompanyName: profile.company.companyName,
        prospectIndustry: profile.idealCustomers.targetIndustries[0] ?? "Field service",
        prospectTitle: profile.idealCustomers.buyerPersonas[0] ?? "Owner",
      })
    : null

  const registryLabels = new Set(SUPPORTED_SERVICE_VERTICALS_REGISTRY.map((entry) => entry.label))
  const missingRegistryLabels = REQUIRED_VERTICAL_LABELS.filter((label) => !registryLabels.has(label))

  const activeMission = objectives.find(
    (row) => row.status === "active" && row.runtime?.running && !row.emergencyStopActive,
  )

  const report = {
    qaMarker: GE_AIOS_AVA_EQUIPIFY_PRODUCTION_READINESS_1A_QA_MARKER,
    organizationId,
    profile: {
      id: approved?.id ?? null,
      approvedAt: approved?.approvedAt ?? null,
      companyName: approved?.companyName ?? null,
      hasCanonicalSellerKnowledge: Boolean(profile?.canonicalSellerKnowledge),
      masterKnowledgeVersion: profile?.canonicalSellerKnowledge?.version ?? null,
      platformName: profile?.canonicalSellerKnowledge?.products?.platformName ?? null,
      explicitSupportedServiceVerticals: profile?.idealCustomers.supportedServiceVerticals?.length ?? 0,
      inferredSupportedServiceVerticalCount: ssv?.supportedServiceVerticals.length ?? 0,
      inferredSupportedServiceVerticalIds: ssv?.supportedServiceVerticals.map((v) => v.id) ?? [],
      geography: profile?.idealCustomers.geography ?? [],
      companySizeRanges: profile?.idealCustomers.companySizeRanges ?? [],
      buyerPersonaCount: profile?.idealCustomers.buyerPersonas.length ?? 0,
      qualificationCriteriaCount: profile?.salesAndMarketing.qualificationCriteria.length ?? 0,
      disqualifierCount: profile?.idealCustomers.disqualifiers.length ?? 0,
      portfolioManagement: profile?.portfolioManagement ?? null,
      portfolioProjection: portfolio,
    },
    projections: {
      leadDiscoveryTopicCount: leadDiscovery?.topics.length ?? 0,
      prospectSearchIndustryAliasCount: psFilters?.industry_aliases?.length ?? 0,
      omtCluster: omt?.operationalCluster ?? null,
      omtTopicPhrases: omt?.topicPhrases ?? [],
    },
    businessStrategy: strategy,
    sellerTruth: sellerTruth
      ? {
          masterKnowledgeVersion: sellerTruth.masterKnowledgeVersion ?? null,
          currentCapabilities: (sellerTruth.currentCapabilities ?? []).slice(0, 8),
          limitations: (sellerTruth.limitations ?? []).slice(0, 4),
        }
      : null,
    mission: {
      activeObjectiveId: activeMission?.id ?? null,
      activeTitle: activeMission?.title ?? null,
      matchesLive1bTarget: activeMission?.title.trim() === LIVE_1B_EQUIPIFY_MISSION_TITLE,
    },
    aiTeammate,
    killSwitches: {
      autonomy_enabled: killSwitches.autonomy_enabled,
      autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
      autonomy_objective_mode_enabled: killSwitches.autonomy_objective_mode_enabled,
      autonomy_generation_enabled: killSwitches.autonomy_generation_enabled,
    },
    admission: {
      deploymentActive: admission.deploymentActive,
      totals: admission.totals,
      evaluated: admission.evaluated,
    },
    pipeline,
    registry: {
      requiredVerticalLabels: REQUIRED_VERTICAL_LABELS.length,
      missingFromRegistry: missingRegistryLabels,
    },
    conflictsForOperatorReview: [
      ...(profile?.idealCustomers.geography.includes("Canada")
        ? ["Geography includes Canada; milestone requires US-only nationwide territory unless operator re-approves."]
        : []),
      ...(profile?.canonicalSellerKnowledge?.company.limitations.some((entry) =>
        /no public list pricing/i.test(entry),
      )
        ? ["Canonical seller knowledge says no public list pricing; equipify.ai/pricing publishes tier pricing — reconcile before outreach."]
        : []),
      ...(profile?.canonicalSellerKnowledge?.products?.platformName === "Equipify Operations" &&
      !profile?.businessStrategy
        ? ["Product architecture (Operations / Sales / Marketing / Ava) not fully authored in businessStrategy — website uses Core/Growth/Scale tier names."]
        : []),
      ...(aiTeammate?.teammateName !== "Ava Sinclair"
        ? [`AI teammate display name is '${aiTeammate?.teammateName ?? "Ava (default)"}' — preferred 'Ava Sinclair' requires operator upsert.`]
        : []),
    ],
  }

  console.log(JSON.stringify(report, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
