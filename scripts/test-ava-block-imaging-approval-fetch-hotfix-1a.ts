/**
 * AVA-BLOCK-IMAGING-APPROVAL-FETCH-HOTFIX-1A — Approval entry path certification.
 *
 * Run:
 *   pnpm test:ava-block-imaging-approval-fetch-hotfix-1a
 */
import assert from "node:assert/strict"
import type { GrowthAiCopilotGeneration } from "../lib/growth/ai-copilot-types"
import { emptyCanonicalOperatorApprovalSnapshot } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { AVA_SUPERVISED_CUTOVER_GENERATION_MODE } from "../lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import {
  buildSupervisedAvaHomeOperatorAttention,
  mergeSupervisedAvaIntoApprovalSnapshot,
} from "../lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import {
  buildCustomerPackageReviewHref,
  buildGrowthReviewHref,
  parseLeadIdFromPackageReviewRoute,
  remapLegacyHrefToGrowthReview,
  resolveOperatorPackageReviewHref,
  resolveSupervisedGenerationReviewHref,
} from "../lib/growth/workspace/ux-1a/review/growth-review-routes"

const CERT_ID = "ava-block-imaging-approval-fetch-hotfix-1a-v1" as const
const BLOCK_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const BLOCK_GENERATION_ID = "2bbacf99-b884-442f-a5b2-ce78132368cf"
const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291"
const BLITZ_GENERATION_ID = "22a25173-1a93-441d-8125-ebfccdad5d02"
const LEGACY_PACKAGE_ID = "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-19T17:23:44.080Z"

function runGate(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
}

function blockDraft(overrides: Partial<GrowthAiCopilotGeneration> = {}): GrowthAiCopilotGeneration {
  return {
    id: BLOCK_GENERATION_ID,
    leadId: BLOCK_LEAD_ID,
    generationType: "cold_email",
    promptVersion: "6.0A-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {
      contactsSupplied: [
        {
          name: "Josh Block",
          email: "josh.block@blockimaging.com",
          contactabilityStatus: "contactable",
        },
      ],
    },
    generatedContent: "Hello Josh, ...",
    generatedSubject: "Block Imaging service workflows",
    classification: {
      primary: "pursue",
      generationMode: AVA_SUPERVISED_CUTOVER_GENERATION_MODE,
      outboundSendAuthorized: false,
      recommendedContact: { name: "Josh Block", email: "josh.block@blockimaging.com" },
    },
    status: "draft",
    sourceReplyId: null,
    inputHash: null,
    playbookInfluenceScore: 0,
    playbookAttribution: {},
    approvedAt: null,
    approvedBy: null,
    sentAt: null,
    createdBy: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function main(): void {
  console.log(`[${CERT_ID}] AVA-BLOCK-IMAGING-APPROVAL-FETCH-HOTFIX-1A certification`)

  runGate("Supervised Home package uses CRM ai-copilot href with lead id", () => {
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [blockDraft()],
      leadsById: new Map([[BLOCK_LEAD_ID, "Block Imaging"]]),
    })
    const merged = mergeSupervisedAvaIntoApprovalSnapshot({
      base: emptyCanonicalOperatorApprovalSnapshot(),
      attention,
    })
    const pkg = merged.topPackage
    assert.ok(pkg)
    assert.equal(pkg.packageSource, "supervised_ava_generation")
    assert.equal(pkg.packageId, BLOCK_GENERATION_ID)
    assert.equal(pkg.leadId, BLOCK_LEAD_ID)
    assert.equal(pkg.reviewHref, buildCustomerPackageReviewHref(BLOCK_LEAD_ID))
    assert.match(pkg.reviewHref, /focus=ai-copilot/)
  })

  runGate("Review/approval package UUIDs are not misread as lead ids", () => {
    assert.equal(
      parseLeadIdFromPackageReviewRoute(
        `/growth/review?tab=packages&item=${BLOCK_GENERATION_ID}`,
      ),
      null,
    )
    assert.equal(
      parseLeadIdFromPackageReviewRoute(
        `/growth/os/approvals?packageId=${BLOCK_GENERATION_ID}`,
      ),
      null,
    )
    assert.equal(parseLeadIdFromPackageReviewRoute(buildCustomerPackageReviewHref(BLOCK_LEAD_ID)), BLOCK_LEAD_ID)
  })

  runGate("Supervised operator resolver ignores legacy review item ids", () => {
    assert.equal(
      resolveOperatorPackageReviewHref({
        leadId: BLOCK_LEAD_ID,
        packageId: BLOCK_GENERATION_ID,
        itemId: `supervised-draft:${BLOCK_GENERATION_ID}`,
        packageSource: "supervised_ava_generation",
      }),
      buildCustomerPackageReviewHref(BLOCK_LEAD_ID),
    )
    assert.equal(
      resolveSupervisedGenerationReviewHref({
        generationId: BLOCK_GENERATION_ID,
        leadId: BLOCK_LEAD_ID,
      }),
      buildCustomerPackageReviewHref(BLOCK_LEAD_ID),
    )
  })

  runGate("Legacy non-UUID package routes still remap to review queue", () => {
    assert.equal(
      remapLegacyHrefToGrowthReview(`/growth/os/approvals?packageId=${encodeURIComponent(LEGACY_PACKAGE_ID)}`),
      buildGrowthReviewHref({ tab: "packages" }),
    )
    assert.equal(
      resolveOperatorPackageReviewHref({
        leadId: BLOCK_LEAD_ID,
        packageId: LEGACY_PACKAGE_ID,
        packageSource: "legacy_hac_package",
      }),
      buildCustomerPackageReviewHref(BLOCK_LEAD_ID),
    )
  })

  runGate("Production Block Imaging fixture shape separates generation id from lead id", () => {
    assert.notEqual(BLOCK_GENERATION_ID, BLOCK_LEAD_ID)
    assert.notEqual(BLITZ_GENERATION_ID, BLITZ_LEAD_ID)
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [blockDraft()],
      leadsById: new Map([[BLOCK_LEAD_ID, "Block Imaging"]]),
    })
    assert.equal(attention.readyForReview[0]?.generationId, BLOCK_GENERATION_ID)
    assert.equal(attention.readyForReview[0]?.leadId, BLOCK_LEAD_ID)
    assert.equal(attention.readyForReview[0]?.reviewHref, buildCustomerPackageReviewHref(BLOCK_LEAD_ID))
  })

  runGate("Home-promoted next lead keeps lead id in click target", () => {
    const legacy = emptyCanonicalOperatorApprovalSnapshot()
    legacy.packages = [
      {
        itemId: "legacy-hac:blitz",
        packageId: "pkg-blitz",
        leadId: BLITZ_LEAD_ID,
        companyName: "Blitz Industries",
        decisionMaker: null,
        draftCount: 1,
        preparedAt: null,
        preparedAgoLabel: null,
        channelLabel: "Hold",
        statusLabel: "Ready for review",
        reviewHref: buildCustomerPackageReviewHref(BLITZ_LEAD_ID),
        packageSource: "legacy_hac_package",
      },
    ]
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [blockDraft()],
      leadsById: new Map([
        [BLOCK_LEAD_ID, "Block Imaging"],
        [BLITZ_LEAD_ID, "Blitz Industries"],
      ]),
    })
    const merged = mergeSupervisedAvaIntoApprovalSnapshot({ base: legacy, attention })
    assert.equal(merged.topPackage?.companyName, "Block Imaging")
    assert.equal(merged.topPackage?.reviewHref, buildCustomerPackageReviewHref(BLOCK_LEAD_ID))
    assert.ok(!merged.packages.some((row) => row.leadId === BLITZ_LEAD_ID))
  })

  console.log(`\n[${CERT_ID}] PASS`)
}

main()
