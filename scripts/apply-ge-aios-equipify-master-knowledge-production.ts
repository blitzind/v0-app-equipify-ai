/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1B — Apply master knowledge enrichment to production profile.
 *
 * Dry-run (default):
 *   pnpm apply:ge-aios-equipify-master-knowledge-production -- --dry-run
 *
 * Apply (requires explicit flags):
 *   pnpm apply:ge-aios-equipify-master-knowledge-production -- --apply --confirm-enrich-production-profile
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  approveBusinessProfileForOrganization,
  fetchBusinessProfileWorkspaceState,
} from "@/lib/growth/business-profile/business-profile-service"
import { insertBusinessProfileDraft } from "@/lib/growth/business-profile/business-profile-repository"
import {
  enrichBusinessProfileFromMasterContextDocument,
  extractMasterContextIngestionHints,
} from "@/lib/growth/business-profile/equipify-master-context-ingestion"
import {
  assessBusinessStrategyCompleteness,
  attachProductionMasterKnowledgeIngestionMeta,
  computeMasterKnowledgeContentFingerprint,
  computeProfileEnrichmentDiff,
  EQUIPIFY_MASTER_KNOWLEDGE_PRODUCTION_ORG_ID,
  isProductionEnrichmentIdempotent,
  validateEnrichedProfileForProductionApply,
} from "@/lib/growth/business-profile/equipify-master-knowledge-production-apply"
import { GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER } from "@/lib/growth/business-profile/equipify-master-knowledge-types"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { buildOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import { buildOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"

const PHASE = "GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1B" as const
const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function parseMode(argv: string[]): {
  dryRun: boolean
  apply: boolean
  confirmed: boolean
} {
  const apply = argv.includes("--apply")
  const confirmed = argv.includes("--confirm-enrich-production-profile")
  const dryRun = argv.includes("--dry-run") || !apply
  return { dryRun, apply, confirmed }
}

function printSection(title: string): void {
  console.log(`\n--- ${title} ---`)
}

function printList(label: string, items: string[]): void {
  console.log(`  ${label} (${items.length})`)
  for (const item of items.slice(0, 20)) {
    console.log(`    - ${item}`)
  }
  if (items.length > 20) console.log(`    ... +${items.length - 20} more`)
}

async function verifySellerTruthAndBrief(
  enrichedProfile: Awaited<ReturnType<typeof enrichBusinessProfileFromMasterContextDocument>>,
  profileId: string,
): Promise<void> {
  const sellerTruth = buildOutreachSellerTruth({
    profileId,
    profile: enrichedProfile,
    sellerCompanyName: enrichedProfile.company.companyName,
    prospectIndustry: "Biomedical and medical equipment service",
    prospectTitle: "President",
  })
  const brief = buildOutreachSalesStrategyBrief({
    leadId: "fixture-lead-1",
    companyName: "Fixture Service Co",
    preparedAt: new Date().toISOString(),
    contactTitle: "President",
    verifiedEvidence: ["Hiring biomedical technicians"],
    sellerTruth,
    approvedProfile: enrichedProfile,
  })
  console.log(`  sellerTruth.masterKnowledgeVersion: ${sellerTruth.masterKnowledgeVersion ?? "(none)"}`)
  console.log(`  sellerTruth.currentCapabilities: ${(sellerTruth.currentCapabilities ?? []).slice(0, 4).join(", ")}`)
  console.log(`  brief.version: ${brief.version}`)
  console.log(`  brief.sellerKnowledgeQuality.ready: ${brief.sellerKnowledgeQuality?.readyForDraftGeneration}`)
}

async function main(): Promise<void> {
  const { dryRun, apply, confirmed } = parseMode(process.argv)
  console.log(`[${PHASE}] Production profile enrichment apply`)
  console.log(`QA marker: ${GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER}`)
  console.log(`Organization: ${EQUIPIFY_MASTER_KNOWLEDGE_PRODUCTION_ORG_ID}`)
  console.log(
    `Mode: ${apply ? "APPLY" : "DRY-RUN"}${apply ? (confirmed ? " (confirmed)" : " (missing confirmation)") : ""}`,
  )

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts (Vercel Production only).")
    process.exit(1)
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = EQUIPIFY_MASTER_KNOWLEDGE_PRODUCTION_ORG_ID
  const workspace = await fetchBusinessProfileWorkspaceState(admin, organizationId)

  if (!workspace.schemaReady) {
    console.error("Business Profile schema not ready.")
    process.exit(1)
  }

  const active = workspace.activeApproved
  if (!active) {
    console.error("No active approved Business Profile found for production org.")
    process.exit(1)
  }

  printSection("1. Current production profile audit")
  console.log(`  profileId: ${active.id}`)
  console.log(`  status: ${active.status}`)
  console.log(`  approvedAt: ${active.approvedAt ?? "(none)"}`)
  console.log(`  updatedAt: ${active.updatedAt}`)
  console.log(`  companyName: ${active.companyName}`)
  console.log(`  website: ${active.website}`)

  const strategyReport = assessBusinessStrategyCompleteness(active.profile)
  console.log(`  businessStrategy completeness: ${(strategyReport.score * 100).toFixed(0)}%`)
  console.log(`  businessStrategy present: ${strategyReport.present.join(", ") || "(none)"}`)
  console.log(`  businessStrategy missing: ${strategyReport.missing.join(", ") || "(none)"}`)
  console.log(
    `  canonicalSellerKnowledge: ${active.profile.canonicalSellerKnowledge ? `yes (${active.profile.canonicalSellerKnowledge.version})` : "no"}`,
  )
  console.log(
    `  masterKnowledgeIngestion: ${active.profile.masterKnowledgeIngestion ? "yes" : "no"}`,
  )
  if (active.profile.masterKnowledgeIngestion) {
    console.log(`    fingerprint: ${active.profile.masterKnowledgeIngestion.contentFingerprint ?? "(none)"}`)
    console.log(
      `    isRuntimeSourceOfTruth: ${active.profile.masterKnowledgeIngestion.isRuntimeSourceOfTruth}`,
    )
  }

  const hints = extractMasterContextIngestionHints({ now: new Date().toISOString() })
  const fingerprint = computeMasterKnowledgeContentFingerprint({
    hints,
    profileId: active.id,
  })

  const enrichedBase = enrichBusinessProfileFromMasterContextDocument(active.profile, {
    ingestedAt: new Date().toISOString(),
  })
  const enriched = attachProductionMasterKnowledgeIngestionMeta(enrichedBase, {
    hints,
    fingerprint,
    appliedAt: new Date().toISOString(),
  })

  printSection("2. Dry-run enrichment diff")
  const diff = computeProfileEnrichmentDiff(active.profile, enriched)
  printList("added", diff.added)
  printList("updated", diff.updated)
  printList("unchanged", diff.unchanged)
  printList("conflicts", diff.conflicts)
  printList("futureRoadmapItems", diff.futureRoadmapItems)
  printList("operatorPreserved", diff.operatorPreserved)

  if (diff.conflicts.length > 0) {
    console.error("\nDry-run blocked — operator-authored conflicts detected.")
    process.exit(1)
  }

  printSection("3. Quality check before apply")
  const quality = validateEnrichedProfileForProductionApply(enriched)
  console.log(`  ready: ${quality.ready}`)
  console.log(`  completeness: ${(quality.completeness.score * 100).toFixed(0)}%`)
  console.log(`  futureCapabilitiesLabeled: ${quality.futureCapabilitiesLabeled}`)
  console.log(`  fabricatedMetricsDetected: ${quality.fabricatedMetricsDetected}`)
  printList("remainingGaps", quality.remainingGaps)

  if (!quality.ready) {
    console.error("\nDry-run blocked — enriched profile quality check failed.")
    process.exit(1)
  }

  const idempotent = isProductionEnrichmentIdempotent(active.profile, enriched)
  printSection("Master Context fingerprint")
  console.log(`  sourceDocumentId: docs/MASTER_CONTEXT_DOCUMENT.md`)
  console.log(`  ingestionVersion: ${GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER}`)
  console.log(`  contentFingerprint: ${fingerprint}`)
  console.log(`  idempotent (same fingerprint on stored profile): ${idempotent}`)

  if (idempotent) {
    printSection("Idempotency result")
    console.log("  no_changes — active profile already enriched with this fingerprint.")
    printSection("Seller Truth / Strategy Brief verification (fixture)")
    await verifySellerTruthAndBrief(enriched, active.id)
    printSection("Production package impact")
    console.log("  Block Imaging package: NOT rebuilt (lead unchanged)")
    console.log(`  Block Imaging lead id (unchanged): ${BLOCK_IMAGING_LEAD_ID}`)
    console.log("  Future packages will consume enriched profile automatically.")
    console.log("  Block Imaging requires one controlled rebuild to benchmark new seller knowledge.")
    console.log(`\n[${PHASE}] DRY-RUN complete — no_changes`)
    process.exit(0)
  }

  printSection("Seller Truth / Strategy Brief verification (fixture)")
  await verifySellerTruthAndBrief(enriched, active.id)

  printSection("Production package impact")
  console.log("  Existing packages: unchanged by this script")
  console.log(`  Block Imaging lead: NOT rebuilt (${BLOCK_IMAGING_LEAD_ID})`)
  console.log("  Future packages will consume enriched profile automatically after apply.")
  console.log("  Block Imaging requires one controlled rebuild afterward to benchmark messaging.")

  if (dryRun && !apply) {
    console.log(`\n[${PHASE}] DRY-RUN complete — safe to apply.`)
    console.log("  Re-run with: --apply --confirm-enrich-production-profile")
    process.exit(0)
  }

  if (!confirmed) {
    console.error("\nApply blocked — missing --confirm-enrich-production-profile flag.")
    process.exit(1)
  }

  printSection("4. Apply")
  const draft = await insertBusinessProfileDraft(admin, {
    organizationId,
    companyName: active.companyName,
    website: active.website,
    profile: enriched,
    draftInput: active.input,
    createdBy: null,
  })

  if (!draft) {
    console.error("Failed to insert enriched profile draft.")
    process.exit(1)
  }

  const approved = await approveBusinessProfileForOrganization(admin, {
    organizationId,
    profileId: draft.id,
    approvedBy: null,
  })

  const after = await fetchBusinessProfileWorkspaceState(admin, organizationId)

  printSection("5. Post-apply verification")
  console.log(`  newProfileId: ${approved.id}`)
  console.log(`  previousProfileId: ${active.id}`)
  console.log(`  status: ${approved.status}`)
  console.log(`  approvedAt: ${approved.approvedAt}`)
  console.log(
    `  canonicalSellerKnowledge: ${after.activeApproved?.profile.canonicalSellerKnowledge ? "present" : "missing"}`,
  )
  console.log(
    `  businessStrategy: ${after.activeApproved?.profile.businessStrategy ? "present" : "missing"}`,
  )
  console.log(
    `  masterKnowledgeIngestion.fingerprint: ${after.activeApproved?.profile.masterKnowledgeIngestion?.contentFingerprint ?? "(none)"}`,
  )
  console.log(`  active approved count expected: 1 (previous approved rejected by canonical flow)`)

  printSection("Idempotency re-check")
  const rerunEnriched = attachProductionMasterKnowledgeIngestionMeta(
    enrichBusinessProfileFromMasterContextDocument(after.activeApproved!.profile, {
      ingestedAt: new Date().toISOString(),
    }),
    { hints, fingerprint, appliedAt: new Date().toISOString() },
  )
  const rerunIdempotent = isProductionEnrichmentIdempotent(
    after.activeApproved!.profile,
    rerunEnriched,
  )
  console.log(`  re-run idempotent: ${rerunIdempotent ? "no_changes" : "would_change"}`)

  console.log(`\n[${PHASE}] APPLY complete`)
}

void main()
