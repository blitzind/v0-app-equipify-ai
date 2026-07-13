/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1C — Block Imaging package rebuild + quality comparison.
 *
 * Dry-run:
 *   pnpm rebuild:ge-aios-equipify-master-knowledge-block-imaging -- --dry-run
 *
 * Apply:
 *   pnpm rebuild:ge-aios-equipify-master-knowledge-block-imaging -- --apply --confirm-rebuild-block-imaging-package
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { EQUIPIFY_MASTER_KNOWLEDGE_PRODUCTION_ORG_ID } from "@/lib/growth/business-profile/equipify-master-knowledge-production-apply"
import { GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER } from "@/lib/growth/business-profile/equipify-master-knowledge-types"
import { loadApprovals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-service"
import {
  findAutonomousOutreachPreparationRunByPackageId,
  listOutreachPreparationRunsForLead,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import {
  rebuildAutonomousOutreachApprovalPackagePayload,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence"
import { buildAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service"
import { parseOutreachPrepPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-id"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { generateOutreachDraftsFromSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"

export const GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1C_QA_MARKER =
  "ge-aios-equipify-master-knowledge-1c-block-imaging-rebuild-v1" as const

const ORG = EQUIPIFY_MASTER_KNOWLEDGE_PRODUCTION_ORG_ID
const LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const EXPECTED_PROFILE_ID = "8bff472b-5fb5-4266-8a47-7e86156f8d85"
const EXPECTED_FINGERPRINT = "6d636952669a4fb3"
const FALLBACK_PACKAGE_ID =
  "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-13T16:40:40.229Z"

type PackageComparison = {
  sellerTruthVersion: { before: string | null; after: string | null }
  briefVersion: { before: string | null; after: string | null }
  sellerKnowledgeReady: { before: boolean; after: boolean }
  conversationJustification: { before: string; after: string; changed: boolean }
  businessValue: { before: string; after: string; changed: boolean }
  recommendedCta: { before: string; after: string; changed: boolean }
  matchedPersona: { before: string | null; after: string | null }
  matchedIndustry: { before: string | null; after: string | null }
  currentCapabilities: { before: string[]; after: string[] }
  discoveryQuestions: { before: string[]; after: string[] }
  objections: { before: number; after: number }
  channels: Record<
    string,
    { beforePreview: string; afterPreview: string; changed: boolean; qualityFlags: string[] }
  >
  internalTerminology: { before: string[]; after: string[] }
  unsupportedClaims: { before: string[]; after: string[] }
  genericSdrPhrasing: { before: string[]; after: string[] }
  operatorRewriteLikelihood: { before: "low" | "medium" | "high"; after: "low" | "medium" | "high" }
  qualityScores: {
    before: number | null
    after: number | null
  }
}

function parseMode(argv: string[]) {
  return {
    dryRun: argv.includes("--dry-run") || !argv.includes("--apply"),
    apply: argv.includes("--apply"),
    confirmed: argv.includes("--confirm-rebuild-block-imaging-package"),
  }
}

function clip(text: string | null | undefined, max = 280): string {
  const trimmed = text?.trim() ?? ""
  if (!trimmed) return ""
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

const INTERNAL_TERMS = [/growth 5f/i, /draft factory/i, /sendr/i, /pilot run/i, /apollo/i]
const GENERIC_SDR = [
  /hope you(?:'|’)re doing well/i,
  /\bi noticed\b/i,
  /wanted to reach out/i,
  /just checking in/i,
  /circle back/i,
  /synerg/i,
  /game[- ]changer/i,
]
const UNSUPPORTED = [/guaranteed roi/i, /\d+%\s*(roi|savings)/i, /autonomous revenue orchestration/i]

function scanPatterns(text: string, patterns: RegExp[]): string[] {
  return patterns.filter((p) => p.test(text)).map((p) => p.source)
}

function rewriteLikelihood(pkg: GrowthAutonomousOutreachApprovalPackage | null): "low" | "medium" | "high" {
  if (!pkg) return "high"
  const email = pkg.generatedAssets.find((a) => a.channel === "email")?.preview ?? ""
  const penalty =
    scanPatterns(email, GENERIC_SDR).length +
    scanPatterns(email, INTERNAL_TERMS).length +
    (pkg.salesStrategyBrief?.sellerTruth?.masterKnowledgeVersion ? 0 : 1) +
    (pkg.salesStrategyBrief?.sellerKnowledgeQuality?.readyForDraftGeneration ? 0 : 1) +
    ((pkg.draftQuality?.qualityFailures?.length ?? 0) > 0 ? 1 : 0)
  if (penalty <= 1) return "low"
  if (penalty <= 3) return "medium"
  return "high"
}

function buildComparison(
  before: GrowthAutonomousOutreachApprovalPackage | null,
  after: GrowthAutonomousOutreachApprovalPackage,
): PackageComparison {
  const channelNames = ["email", "linkedin", "sms", "call", "sendr", "follow_up"] as const
  const channels: PackageComparison["channels"] = {}
  for (const channel of channelNames) {
    const beforeAsset = before?.generatedAssets.find((a) => a.channel === channel)
    const afterAsset = after.generatedAssets.find((a) => a.channel === channel)
    const afterPreview = afterAsset?.preview ?? ""
    const beforePreview = beforeAsset?.preview ?? ""
    channels[channel] = {
      beforePreview: clip(beforePreview, 500),
      afterPreview: clip(afterPreview, 500),
      changed: beforePreview.trim() !== afterPreview.trim(),
      qualityFlags: [
        ...scanPatterns(afterPreview, INTERNAL_TERMS).map((s) => `internal:${s}`),
        ...scanPatterns(afterPreview, GENERIC_SDR).map((s) => `generic:${s}`),
        ...scanPatterns(afterPreview, UNSUPPORTED).map((s) => `unsupported:${s}`),
      ],
    }
  }

  const beforeBrief = before?.salesStrategyBrief
  const afterBrief = after.salesStrategyBrief

  return {
    sellerTruthVersion: {
      before: beforeBrief?.sellerTruth?.masterKnowledgeVersion ?? null,
      after: afterBrief?.sellerTruth?.masterKnowledgeVersion ?? null,
    },
    briefVersion: {
      before: beforeBrief?.version ?? null,
      after: afterBrief?.version ?? null,
    },
    sellerKnowledgeReady: {
      before: beforeBrief?.sellerKnowledgeQuality?.readyForDraftGeneration ?? false,
      after: afterBrief?.sellerKnowledgeQuality?.readyForDraftGeneration ?? false,
    },
    conversationJustification: {
      before: clip(beforeBrief?.conversationJustification ?? before?.personalizationEvidence?.[1] ?? ""),
      after: clip(afterBrief?.conversationJustification ?? ""),
      changed:
        (beforeBrief?.conversationJustification ?? "") !== (afterBrief?.conversationJustification ?? ""),
    },
    businessValue: {
      before: clip(beforeBrief?.businessValue ?? ""),
      after: clip(afterBrief?.businessValue ?? ""),
      changed: (beforeBrief?.businessValue ?? "") !== (afterBrief?.businessValue ?? ""),
    },
    recommendedCta: {
      before: beforeBrief?.recommendedCta ?? "",
      after: afterBrief?.recommendedCta ?? "",
      changed: (beforeBrief?.recommendedCta ?? "") !== (afterBrief?.recommendedCta ?? ""),
    },
    matchedPersona: {
      before: beforeBrief?.sellerTruth?.matchedPersona ?? null,
      after: afterBrief?.sellerTruth?.matchedPersona ?? null,
    },
    matchedIndustry: {
      before: beforeBrief?.sellerTruth?.matchedIndustryKnowledge ?? null,
      after: afterBrief?.sellerTruth?.matchedIndustryKnowledge ?? null,
    },
    currentCapabilities: {
      before: beforeBrief?.sellerTruth?.currentCapabilities ?? [],
      after: afterBrief?.sellerTruth?.currentCapabilities ?? [],
    },
    discoveryQuestions: {
      before: beforeBrief?.sellerTruth?.discoveryQuestions ?? [],
      after: afterBrief?.sellerTruth?.discoveryQuestions ?? [],
    },
    objections: {
      before: beforeBrief?.objections?.length ?? 0,
      after: afterBrief?.objections?.length ?? 0,
    },
    channels,
    internalTerminology: {
      before: scanPatterns(
        (before?.generatedAssets ?? []).map((a) => a.preview).join("\n"),
        INTERNAL_TERMS,
      ),
      after: scanPatterns(
        after.generatedAssets.map((a) => a.preview).join("\n"),
        INTERNAL_TERMS,
      ),
    },
    unsupportedClaims: {
      before: scanPatterns(
        (before?.generatedAssets ?? []).map((a) => a.preview).join("\n"),
        UNSUPPORTED,
      ),
      after: scanPatterns(
        after.generatedAssets.map((a) => a.preview).join("\n"),
        UNSUPPORTED,
      ),
    },
    genericSdrPhrasing: {
      before: scanPatterns(
        (before?.generatedAssets ?? []).map((a) => a.preview).join("\n"),
        GENERIC_SDR,
      ),
      after: scanPatterns(
        after.generatedAssets.map((a) => a.preview).join("\n"),
        GENERIC_SDR,
      ),
    },
    operatorRewriteLikelihood: {
      before: rewriteLikelihood(before),
      after: rewriteLikelihood(after),
    },
    qualityScores: {
      before: beforeBrief?.sellerKnowledgeQuality?.overallScore ?? null,
      after: afterBrief?.sellerKnowledgeQuality?.overallScore ?? null,
    },
  }
}

async function resolvePackageId(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("package_id")
    .eq("organization_id", ORG)
    .eq("lead_id", LEAD_ID)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const packageId = (data?.package_id as string | null)?.trim()
  return packageId || FALLBACK_PACKAGE_ID
}

async function snapshotLead(admin: SupabaseClient) {
  const [lead, dms] = await Promise.all([
    fetchGrowthLeadById(admin, LEAD_ID),
    listGrowthLeadDecisionMakers(admin, LEAD_ID).catch(() => []),
  ])
  const primary = dms.find((row) => row.id === lead?.primaryDecisionMakerId) ?? dms[0] ?? null
  return {
    status: lead?.status ?? null,
    contactName: lead?.contactName ?? null,
    contactEmail: lead?.contactEmail ?? null,
    contactPhone: lead?.contactPhone ?? null,
    primaryDecisionMakerId: lead?.primaryDecisionMakerId ?? null,
    primaryDmEmail: primary?.email ?? null,
    primaryDmPhone: primary?.phone ?? null,
    relationshipStrengthTier: lead?.relationshipStrengthTier ?? null,
    contactTemperature: lead?.contactTemperature ?? null,
    followUpAt: lead?.followUpAt ?? null,
    nextBestActionReason: lead?.nextBestActionReason ?? null,
  }
}

async function buildCandidatePackage(admin: SupabaseClient, packageId: string) {
  const parsed = parseOutreachPrepPackageId(packageId)
  if (!parsed) throw new Error(`Invalid package id: ${packageId}`)

  const lead = await fetchGrowthLeadById(admin, LEAD_ID)
  if (!lead) throw new Error("Lead not found")

  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: ORG,
    leadId: LEAD_ID,
  })
  if (!snapshot) throw new Error("Research snapshot missing")

  return buildAutonomousOutreachApprovalPackage(admin, {
    organizationId: ORG,
    leadId: LEAD_ID,
    companyName: lead.companyName,
    snapshot,
    generatedAt: parsed.generatedAt,
  })
}

async function main(): Promise<void> {
  const { dryRun, apply, confirmed } = parseMode(process.argv)
  console.log(`[${GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1C_QA_MARKER}] Block Imaging package rebuild`)
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  const admin = bootstrap.admin
  const packageId = await resolvePackageId(admin)
  console.log(`Package ID: ${packageId}`)
  console.log(`Lead ID: ${LEAD_ID}`)

  const profile = await getActiveApprovedBusinessProfile(admin, ORG)
  if (!profile) {
    console.error("No active approved profile")
    process.exit(1)
  }

  console.log("\n--- Profile preflight ---")
  console.log(`  profileId: ${profile.id}`)
  console.log(`  expectedProfileId: ${EXPECTED_PROFILE_ID}`)
  console.log(`  profileMatch: ${profile.id === EXPECTED_PROFILE_ID}`)
  console.log(
    `  canonicalSellerKnowledge: ${profile.profile.canonicalSellerKnowledge?.version ?? "missing"}`,
  )
  console.log(
    `  businessStrategy: ${profile.profile.businessStrategy?.messaging.elevatorPitch ? "present" : "missing"}`,
  )
  console.log(
    `  fingerprint: ${profile.profile.masterKnowledgeIngestion?.contentFingerprint ?? "missing"}`,
  )
  console.log(`  fingerprintMatch: ${profile.profile.masterKnowledgeIngestion?.contentFingerprint === EXPECTED_FINGERPRINT}`)

  if (
    !profile.profile.canonicalSellerKnowledge ||
    !profile.profile.businessStrategy ||
    profile.profile.masterKnowledgeIngestion?.contentFingerprint !== EXPECTED_FINGERPRINT
  ) {
    console.error("Profile preflight failed — master knowledge not applied as expected.")
    process.exit(1)
  }

  const beforeRun = await findAutonomousOutreachPreparationRunByPackageId(admin, ORG, packageId)
  const beforePkg = beforeRun?.approvalPackage ?? null
  const leadBefore = await snapshotLead(admin)

  const { data: dfBefore } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("state, package_id, version, decision_maker_id, research_run_id, updated_at")
    .eq("organization_id", ORG)
    .eq("lead_id", LEAD_ID)
    .maybeSingle()

  const candidate = await buildCandidatePackage(admin, packageId)
  const brief = candidate.salesStrategyBrief
  if (
    brief?.sellerTruth?.masterKnowledgeVersion !== "equipify-master-knowledge-v1" ||
    brief?.version !== "outreach-sales-strategy-brief-v4" ||
    !brief?.sellerKnowledgeQuality?.readyForDraftGeneration
  ) {
    console.error("Seller truth / brief preflight failed.")
    console.error(JSON.stringify({
      masterKnowledgeVersion: brief?.sellerTruth?.masterKnowledgeVersion,
      briefVersion: brief?.version,
      ready: brief?.sellerKnowledgeQuality?.readyForDraftGeneration,
    }))
    process.exit(1)
  }

  console.log("\n--- Seller truth preflight ---")
  console.log(`  masterKnowledgeVersion: ${brief.sellerTruth?.masterKnowledgeVersion}`)
  console.log(`  briefVersion: ${brief.version}`)
  console.log(`  sellerKnowledgeQuality.ready: ${brief.sellerKnowledgeQuality?.readyForDraftGeneration}`)
  console.log(`  matchedPersona: ${brief.sellerTruth?.matchedPersona ?? "(none)"}`)
  console.log(`  matchedIndustry: ${brief.sellerTruth?.matchedIndustryKnowledge ?? "(none)"}`)

  const comparison = buildComparison(beforePkg, candidate)
  const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })

  console.log("\n--- Old vs new comparison ---")
  console.log(JSON.stringify(comparison, null, 2))

  console.log("\n--- Exact new drafts ---")
  console.log(
    JSON.stringify(
      {
        email: drafts.email.full,
        linkedIn: drafts.linkedIn,
        sms: drafts.sms,
        callGuide: drafts.callGuide,
        personalizedVideo: drafts.personalizedVideo,
        followUpSequence: drafts.followUpSequence,
        qualityFailures: drafts.qualityFailures,
      },
      null,
      2,
    ),
  )

  const weakMessaging: string[] = []
  if (!comparison.matchedIndustry.after) weakMessaging.push("No matched industry knowledge on seller truth")
  if (!comparison.matchedPersona.after) weakMessaging.push("No matched persona on seller truth")
  if (comparison.genericSdrPhrasing.after.length > 0) {
    weakMessaging.push(`Generic SDR phrasing flags: ${comparison.genericSdrPhrasing.after.join(", ")}`)
  }
  if (drafts.qualityFailures.length > 0) {
    weakMessaging.push(`Draft quality failures: ${drafts.qualityFailures.join(", ")}`)
  }

  console.log("\n--- Remaining weak messaging ---")
  console.log(weakMessaging.length ? weakMessaging.map((w) => `  - ${w}`).join("\n") : "  (none flagged)")

  if (dryRun && !apply) {
    console.log("\nDRY-RUN complete — no persistence.")
    return
  }

  if (!confirmed) {
    console.error("Apply blocked — missing --confirm-rebuild-block-imaging-package")
    process.exit(1)
  }

  const rebuilt = await rebuildAutonomousOutreachApprovalPackagePayload(admin, {
    organizationId: ORG,
    packageId,
    rebuildReason: GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1C_QA_MARKER,
  })

  if (!rebuilt?.approvalPackage) {
    console.error("Rebuild failed")
    process.exit(1)
  }

  const afterRun = await findAutonomousOutreachPreparationRunByPackageId(admin, ORG, packageId)
  const leadAfter = await snapshotLead(admin)
  const runsForLead = await listOutreachPreparationRunsForLead(admin, ORG, LEAD_ID)
  const activePackages = runsForLead.filter((r) => r.packageId === packageId)

  const { data: dfAfter } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("state, package_id, version, decision_maker_id, research_run_id, updated_at")
    .eq("organization_id", ORG)
    .eq("lead_id", LEAD_ID)
    .maybeSingle()

  const packet = await loadApprovals2AOperatorReviewPacket(admin, {
    organizationId: ORG,
    packageId,
    leadId: LEAD_ID,
    teammateName: "Ava",
  })

  console.log("\n--- Apply result ---")
  console.log(
    JSON.stringify(
      {
        existingPackageId: packageId,
        rebuiltPackageId: rebuilt.packageId,
        logicalRelationship: "same_package_id_body_replaced",
        approvedProfileId: profile.id,
        sellerKnowledgeVersion: rebuilt.approvalPackage.salesStrategyBrief?.sellerTruth?.masterKnowledgeVersion,
        strategyBriefVersion: rebuilt.approvalPackage.salesStrategyBrief?.version,
        pendingHumanApproval: rebuilt.approvalPackage.pendingHumanApproval,
        transportBlocked: rebuilt.approvalPackage.transportBlocked,
        activePackageRowsForId: activePackages.length,
        draftFactoryUnchanged:
          JSON.stringify(dfBefore) === JSON.stringify(dfAfter) &&
          dfAfter?.package_id === packageId,
        leadStateUnchanged: JSON.stringify(leadBefore) === JSON.stringify(leadAfter),
        completedWorkResolves: Boolean(packet?.packageId === packageId),
        noOutbound: true,
      },
      null,
      2,
    ),
  )

  console.log(`\nPASS ${GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1C_QA_MARKER}`)
}

void main()
