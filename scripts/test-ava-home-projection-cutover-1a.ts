/**
 * AVA-HOME-PROJECTION-CUTOVER-1A — Home supervised Ava projection certification.
 *
 * Run:
 *   pnpm test:ava-home-projection-cutover-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { GrowthAiCopilotGeneration } from "../lib/growth/ai-copilot-types"
import { emptyCanonicalOperatorApprovalSnapshot } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  mapCanonicalApprovalPackagesToWaitingOnYou,
  resolveCanonicalWaitingOnYouItems,
} from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { partitionOperatorWaitingItems } from "../lib/growth/aios/operator-experience/growth-operator-home-ava-direct-2a"
import { AVA_SUPERVISED_CUTOVER_GENERATION_MODE } from "../lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import {
  AVA_HOME_PROJECTION_CUTOVER_1A_QA_MARKER,
  supervisedNeedsInformationToWaitingOnYou,
} from "../lib/growth/ava-reasoning/equipify-supervised-home-projection-1a-types"
import {
  buildSupervisedAvaHomeOperatorAttention,
  isReviewableSupervisedAvaGeneration,
  isSupervisedNeedsInformationGeneration,
  mergeSupervisedAvaIntoApprovalSnapshot,
} from "../lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { buildCustomerPackageReviewHref } from "../lib/growth/workspace/ux-1a/review/growth-review-routes"

const CERTIFICATION_ID = "ava-home-projection-cutover-1a-v1" as const
const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const DIVERSE_POWER_LEAD_ID = "00000000-0000-4000-8000-000000000001"

const PROJECTION_SOURCES = [
  "lib/growth/ava-reasoning/equipify-supervised-home-projection-1a.ts",
  "lib/growth/ava-reasoning/equipify-supervised-home-projection-1a-types.ts",
  "lib/growth/home/growth-home-workspace-summary-service.ts",
  "lib/growth/home/growth-home-workspace-summary-types.ts",
  "lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a.ts",
] as const

const FORBIDDEN_MUTATION_PATTERNS = [
  /runEquipifySupervisedAvaOutreach/,
  /persistSendableAvaSupervisedDraft/,
  /runEquipifyAvaDirectReasoning/,
  /CREATE TABLE|ALTER TABLE|DROP TABLE/i,
  /executeOutbound|sendOutbound|queueSequence/i,
] as const

const UNTOUCHED_AUTHORITY_FILES = [
  "lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts",
  "lib/growth/ava-reasoning/equipify-supervised-draft-persistence.ts",
] as const

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function runGate(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
}

function blockImagingDraft(overrides: Partial<GrowthAiCopilotGeneration> = {}): GrowthAiCopilotGeneration {
  return {
    id: "gen-block-imaging",
    leadId: BLOCK_IMAGING_LEAD_ID,
    generationType: "cold_email",
    promptVersion: "6.0A-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {
      contactsSupplied: [
        {
          name: "Jane Smith",
          email: "jane@blockimaging.com",
          contactabilityStatus: "contactable",
        },
      ],
    },
    generatedContent: "Hello Jane, ...",
    generatedSubject: "Imaging equipment partnership",
    classification: {
      primary: "pursue",
      generationMode: AVA_SUPERVISED_CUTOVER_GENERATION_MODE,
      outboundSendAuthorized: false,
      rationale: "Strong fit for imaging services.",
      recommendedContact: { name: "Jane Smith", email: "jane@blockimaging.com" },
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
  console.log(`[${CERTIFICATION_ID}] AVA-HOME-PROJECTION-CUTOVER-1A focused certification`)

  runGate("QA marker matches certification id", () => {
    assert.equal(AVA_HOME_PROJECTION_CUTOVER_1A_QA_MARKER, CERTIFICATION_ID)
  })

  runGate("Home workspace summary loads supervised Ava projection", () => {
    const service = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
    assert.match(service, /loadSupervisedAvaGenerationsForHome/)
    assert.match(service, /mergeSupervisedAvaIntoApprovalSnapshot/)
    assert.match(service, /supervisedOperatorAttention/)
    assert.match(service, /email draft/)
    assert.match(service, /ready for review/)
  })

  runGate("Reviewable supervised drafts are recognized", () => {
    const draft = blockImagingDraft()
    assert.equal(isReviewableSupervisedAvaGeneration(draft), true)

    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [draft],
      leadsById: new Map([[BLOCK_IMAGING_LEAD_ID, "Block Imaging"]]),
    })
    assert.equal(attention.readyForReview.length, 1)
    assert.equal(attention.readyForReview[0]?.companyName, "Block Imaging")
    assert.equal(attention.readyForReview[0]?.outboundSendAuthorized, false)
  })

  runGate("Block Imaging-style draft outranks legacy Diverse Power hold", () => {
    const legacy = emptyCanonicalOperatorApprovalSnapshot()
    legacy.packages = [
      {
        itemId: "legacy-hac:diverse-power",
        packageId: "pkg-diverse-power",
        leadId: DIVERSE_POWER_LEAD_ID,
        companyName: "Diverse Power Foundation",
        decisionMaker: null,
        draftCount: 0,
        preparedAt: null,
        preparedAgoLabel: null,
        channelLabel: "Hold — needs decision maker",
        statusLabel: "Needs information",
        reviewHref: "/growth/leads/crm?open=legacy",
      },
    ]
    legacy.topPackage = legacy.packages[0] ?? null
    legacy.outreachPackageCount = 1
    legacy.pendingApprovalCount = 1
    legacy.waitingForOperator = true

    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [blockImagingDraft()],
      leadsById: new Map([
        [BLOCK_IMAGING_LEAD_ID, "Block Imaging"],
        [DIVERSE_POWER_LEAD_ID, "Diverse Power Foundation"],
      ]),
    })

    const merged = mergeSupervisedAvaIntoApprovalSnapshot({ base: legacy, attention })
    assert.equal(merged.topPackage?.companyName, "Block Imaging")
    assert.equal(merged.packages[0]?.companyName, "Block Imaging")
    assert.ok(
      !merged.packages.some((row) => /diverse power/i.test(row.companyName)),
      "Legacy Diverse Power hold must not remain ahead of supervised draft",
    )
  })

  runGate("Review route includes open lead and AI Copilot focus", () => {
    const href = buildCustomerPackageReviewHref(BLOCK_IMAGING_LEAD_ID)
    assert.match(href, /open=6d9220f0-2960-468c-b4be-5d7595d292c3/)
    assert.match(href, /focus=ai-copilot/)

    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [blockImagingDraft()],
      leadsById: new Map([[BLOCK_IMAGING_LEAD_ID, "Block Imaging"]]),
    })
    assert.equal(attention.readyForReview[0]?.reviewHref, href)
  })

  runGate("Reject outcomes are excluded from primary attention", () => {
    const reject = blockImagingDraft({
      id: "gen-reject",
      leadId: "03a361d3-e6b6-42e6-bc78-a5773acc1725",
      classification: {
        primary: "reject",
        generationMode: AVA_SUPERVISED_CUTOVER_GENERATION_MODE,
        outboundSendAuthorized: false,
        rationale: "Not a fit.",
      },
    })

    assert.equal(isReviewableSupervisedAvaGeneration(reject), false)
    assert.equal(isSupervisedNeedsInformationGeneration(reject), false)

    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [reject, blockImagingDraft()],
      leadsById: new Map([
        [BLOCK_IMAGING_LEAD_ID, "Block Imaging"],
        ["03a361d3-e6b6-42e6-bc78-a5773acc1725", "Best Buy"],
      ]),
    })
    assert.equal(attention.rejectedCount, 1)
    assert.equal(attention.readyForReview.length, 1)
    assert.equal(attention.needsInformation.length, 0)
  })

  runGate("Pursue without contact appears only under Needs information", () => {
    const pursueNoContact = blockImagingDraft({
      id: "gen-naes",
      leadId: "b06417cf-8c67-4705-82f3-0b62e3d08ca2",
      generatedSubject: "",
      generatedContent: "",
      inputSnapshot: {},
      classification: {
        primary: "pursue",
        generationMode: AVA_SUPERVISED_CUTOVER_GENERATION_MODE,
        outboundSendAuthorized: false,
        rationale: "Strong fit but no contact yet.",
        missingInformation: ["decision maker contact"],
      },
    })

    assert.equal(isReviewableSupervisedAvaGeneration(pursueNoContact), false)
    assert.equal(isSupervisedNeedsInformationGeneration(pursueNoContact), true)

    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [pursueNoContact, blockImagingDraft()],
      leadsById: new Map([
        [BLOCK_IMAGING_LEAD_ID, "Block Imaging"],
        ["b06417cf-8c67-4705-82f3-0b62e3d08ca2", "NAES"],
      ]),
    })
    assert.equal(attention.readyForReview.length, 1)
    assert.equal(attention.needsInformation.length, 1)
    assert.equal(attention.needsInformation[0]?.decision, "pursue")

    const waiting = resolveCanonicalWaitingOnYouItems({
      approvalSnapshot: mergeSupervisedAvaIntoApprovalSnapshot({
        base: emptyCanonicalOperatorApprovalSnapshot(),
        attention,
      }),
      legacyItems: [],
      supervisedNeedsInformation: supervisedNeedsInformationToWaitingOnYou(attention.needsInformation),
    })

    const partitioned = partitionOperatorWaitingItems(waiting)
    assert.equal(partitioned.readyForReview.length, 1)
    assert.equal(partitioned.needsInformation.length, 1)
    assert.match(partitioned.needsInformation[0]?.label ?? "", /Need decision maker/i)
  })

  runGate("Waiting-on-you maps supervised draft detail for Home review", () => {
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [blockImagingDraft()],
      leadsById: new Map([[BLOCK_IMAGING_LEAD_ID, "Block Imaging"]]),
    })
    const snapshot = mergeSupervisedAvaIntoApprovalSnapshot({
      base: emptyCanonicalOperatorApprovalSnapshot(),
      attention,
    })
    const rows = mapCanonicalApprovalPackagesToWaitingOnYou(snapshot)
    assert.match(rows[0]?.label ?? "", /Review email draft/)
    assert.match(rows[0]?.detail ?? "", /Imaging equipment partnership/)
    assert.match(rows[0]?.href ?? "", /focus=ai-copilot/)
  })

  runGate("Outbound authorization remains false on supervised ready items", () => {
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [blockImagingDraft()],
      leadsById: new Map([[BLOCK_IMAGING_LEAD_ID, "Block Imaging"]]),
    })
    for (const row of attention.readyForReview) {
      assert.equal(row.outboundSendAuthorized, false)
    }
  })

  runGate("Projection layer does not alter reasoning, persistence, schema, or transport", () => {
    for (const relativePath of PROJECTION_SOURCES) {
      const source = readSource(relativePath)
      for (const pattern of FORBIDDEN_MUTATION_PATTERNS) {
        assert.doesNotMatch(
          source,
          pattern,
          `${relativePath} must not mutate forbidden authorities`,
        )
      }
    }

    const cutover = readSource(UNTOUCHED_AUTHORITY_FILES[0]!)
    const persistence = readSource(UNTOUCHED_AUTHORITY_FILES[1]!)
    assert.match(cutover, /runEquipifySupervisedAvaOutreach/)
    assert.match(persistence, /persistSendableAvaSupervisedDraft/)
  })

  console.log(`[${CERTIFICATION_ID}] PASS`)
}

main()
