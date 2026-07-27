/**
 * AVA-BLOCK-IMAGING-FRESH-GENERATION-1A — Focused certification (no GPT, no send).
 *
 *   pnpm test:ava-block-imaging-fresh-generation-1a
 */

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
  BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  BLOCK_IMAGING_LEGACY_GENERATION_ID,
  isPersistedSupervisedDraftBodyUnsigned,
  PROPOSED_STALE_DRAFT_FRESHNESS_INVARIANT,
  wouldDuplicateReuseBlockRegeneration,
} from "../lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a"
import {
  bodyContainsLegacyAvaSignatureMarkers,
  stripAccidentalAvaSignatureFromBody,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"

const CERT_ID = "ava-block-imaging-fresh-generation-1a-v1" as const

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

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] AVA-BLOCK-IMAGING-FRESH-GENERATION-1A certification`)

  runGate("Recovery module scoped to Block Imaging allowlist", () => {
    assert.equal(BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID, "6d9220f0-2960-468c-b4be-5d7595d292c3")
    assert.equal(BLOCK_IMAGING_LEGACY_GENERATION_ID, "2bbacf99-b884-442f-a5b2-ce78132368cf")
    const recovery = readSource("lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a.ts")
    assert.match(recovery, /RECOVERY_ALLOWLIST/)
    assert.match(recovery, /discardGrowthAiCopilotGeneration/)
    assert.match(recovery, /runEquipifySupervisedAvaOutreach/)
    assert.match(recovery, /resolveEarliestIncompleteDurableStage/)
  })

  runGate("Persistence boundary strips accidental signatures before insert", () => {
    const persistence = readSource("lib/growth/ava-reasoning/equipify-supervised-draft-persistence.ts")
    assert.match(persistence, /stripAccidentalAvaSignatureFromBody/)
    assert.match(
      readSource("lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts"),
      /stripAccidentalAvaSignatureFromBody/,
    )
  })

  runGate("Home preview shows unsigned body only (no transport signature append)", () => {
    const preview = readSource("lib/growth/home/growth-home-review-queue-preview-client-1b.ts")
    assert.match(preview, /unsignedBody/)
    assert.doesNotMatch(preview, /signaturePayload\.signatureText\?\.trim\(\)/)
    assert.match(preview, /Mailbox assigned at approval/)
  })

  runGate("Legacy signed body normalizes to unsigned at persistence boundary", () => {
    const signedBody = [
      "Hi Josh,",
      "",
      "Block Imaging looks like a strong fit.",
      "",
      "--",
      "Ava Sinclair",
      "Growth Advisor",
      "Equipify.ai",
    ].join("\n")
    const stripped = stripAccidentalAvaSignatureFromBody(signedBody)
    assert.equal(bodyContainsLegacyAvaSignatureMarkers(stripped), false)
    assert.equal(isPersistedSupervisedDraftBodyUnsigned(stripped), true)
  })

  runGate("duplicate_reused blocks regeneration when actionable draft exists", () => {
    assert.equal(
      wouldDuplicateReuseBlockRegeneration({
        existingDraft: { id: BLOCK_IMAGING_LEGACY_GENERATION_ID } as never,
      }),
      true,
    )
    assert.equal(wouldDuplicateReuseBlockRegeneration({ existingDraft: null }), false)
  })

  runGate("Stale-draft freshness invariant documented", () => {
    assert.match(PROPOSED_STALE_DRAFT_FRESHNESS_INVARIANT.summary, /legacy signature markers/)
    assert.ok(PROPOSED_STALE_DRAFT_FRESHNESS_INVARIANT.triggers.length >= 2)
  })

  runGate("Production probe and recovery scripts exist", () => {
    assert.match(
      readSource("scripts/probe-ava-block-imaging-fresh-generation-1a-production.ts"),
      /BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID/,
    )
    assert.match(
      readSource("scripts/recover-ava-block-imaging-fresh-generation-1a-production.ts"),
      /AVA_BLOCK_IMAGING_FRESH_GENERATION_1A_CONFIRM/,
    )
  })

  runGate("Recovery uses existing discard lifecycle not direct body mutation", () => {
    const recovery = readSource("lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a.ts")
    assert.match(recovery, /discardGrowthAiCopilotGeneration/)
    assert.doesNotMatch(recovery, /updateGrowthAiCopilotGenerationContent/)
    assert.doesNotMatch(recovery, /generatedContent:/)
  })

  console.log(`[${AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
