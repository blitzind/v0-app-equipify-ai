/**
 * AVA-HOME-WORKSPACE-SUMMARY-50S-REGRESSION-1A — Focused certification (no send/approval/mutation).
 * Run: pnpm test:ava-home-workspace-summary-50s-regression-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  collectHomeFirstTouchCandidateLeadIds,
  loadFirstTouchOutboundCompletionByLeadId,
} from "@/lib/growth/ava-reasoning/ava-first-touch-outbound-completion-1a"
import { BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID } from "@/lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a"
import {
  buildSupervisedAvaHomeOperatorAttention,
  isSendEligibleSupervisedAvaGeneration,
  isReviewableSupervisedAvaGeneration,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import { GROWTH_HOME_WORKSPACE_LOADER_BUDGET_MS } from "@/lib/growth/home/growth-home-workspace-loader-budget"

const CERT_ID = "ava-home-workspace-summary-50s-regression-1a-v1" as const

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function runGate(label: string, fn: () => void): void {
  fn()
  console.log(`  ✓ ${label}`)
}

function supervisedGeneration(overrides: Partial<GrowthAiCopilotGeneration> = {}): GrowthAiCopilotGeneration {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    leadId: BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
    generationType: "cold_email",
    promptVersion: "1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {},
    generatedContent: "Hello",
    generatedSubject: "Subject",
    classification: { primary: "pursue", generationMode: "ava_direct_production_cutover_1a" },
    status: "approved",
    sourceReplyId: null,
    inputHash: "hash",
    playbookInfluenceScore: null,
    playbookAttribution: null,
    approvedAt: "2026-07-27T12:00:00.000Z",
    approvedBy: "operator",
    sentAt: null,
    createdBy: "ava",
    createdAt: "2026-07-27T12:00:00.000Z",
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] certification`)

  runGate("1. first-touch guard preserved in Home projection path", () => {
    const source = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
    assert.match(source, /firstTouchCompleteLeadIds/)
    assert.match(source, /collectHomeFirstTouchCandidateLeadIds/)
  })

  runGate("2. Home first-touch lookup scoped to actionable candidates only", () => {
    const candidates = collectHomeFirstTouchCandidateLeadIds({
      supervisedGenerations: [supervisedGeneration()],
      approvalPackageLeadIds: [BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID],
    })
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0], BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID)
  })

  runGate("3. no per-lead Promise.all transport N+1 in batch loader", () => {
    const source = readSource("lib/growth/ava-reasoning/ava-first-touch-outbound-completion-1a.ts")
    assert.match(source, /batchResolveFirstTouchFromTransportTables/)
    assert.doesNotMatch(
      source,
      /loadFirstTouchOutboundCompletionByLeadId[\s\S]*Promise\.all\([\s\S]*resolveFirstTouchOutboundCompletionForLead/,
    )
  })

  runGate("4. approvedReadyToSend preserved in supervised projection", () => {
    const source = readSource("lib/growth/ava-reasoning/equipify-supervised-home-projection-1a.ts")
    assert.match(source, /approvedReadyToSend/)
    assert.match(source, /isSendEligibleSupervisedAvaGeneration/)
  })

  runGate("5. readyForReview preserved in supervised projection", () => {
    const source = readSource("lib/growth/ava-reasoning/equipify-supervised-home-projection-1a.ts")
    assert.match(source, /readyForReview/)
    assert.match(source, /isReviewableSupervisedAvaGeneration/)
  })

  runGate("6. optional Home loaders remain budget-bounded", () => {
    assert.ok(GROWTH_HOME_WORKSPACE_LOADER_BUDGET_MS <= 10_000)
    const source = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
    assert.match(source, /withGrowthHomeLoaderBudget/)
  })

  runGate("7. discovery provider execution cannot occur during Home read", () => {
    const discovery = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
    const summary = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
    assert.doesNotMatch(summary, /runProspectSearchDatamoonAutonomousDiscovery/)
    assert.doesNotMatch(summary, /startDatamoonAudienceImportRun/)
    assert.doesNotMatch(discovery, /buildGrowthHomeWorkspaceSummary/)
  })

  await (async () => {
    const admin = {
      schema: () => ({
        from: () => ({
          select: () => ({
            in: () => ({
              eq: () => ({
                order: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    } as never

    const result = await loadFirstTouchOutboundCompletionByLeadId(admin, {
      leadIds: [BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID],
      leadsById: new Map([
        [
          BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
          {
            metadata: {
              avaFirstTouchOutboundCompletion: {
                qaMarker: "ava-first-touch-outbound-completion-1a-v1",
                complete: true,
                completedAt: "2026-07-19T00:00:00.000Z",
                evidenceKind: "delivery_attempt_sent",
              },
            },
          },
        ],
      ]),
    })
    assert.equal(result.size, 1)
    assert.equal(result.get(BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID)?.evidenceKind, "delivery_attempt_sent")
    console.log("  ✓ 8. first-touch batch skips transport when metadata already complete")
  })()

  runGate("9. supervised attention excludes first-touch-complete leads", () => {
    const attention = buildSupervisedAvaHomeOperatorAttention({
      generations: [supervisedGeneration()],
      leadsById: new Map([[BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID, "Block Imaging"]]),
      firstTouchCompleteLeadIds: new Set([BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID]),
    })
    assert.equal(attention.approvedReadyToSend.length, 0)
    assert.equal(attention.readyForReview.length, 0)
    assert.ok(attention.sentLeadIds.includes(BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID))
  })

  runGate("10. no approval/send in workspace-summary service", () => {
    const source = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
    assert.doesNotMatch(source, /approveFirstTouch|sendOutbound|executeBulkPushToLeadInbox/i)
  })

  console.log(`\n[${CERT_ID}] PASS 10/10`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
