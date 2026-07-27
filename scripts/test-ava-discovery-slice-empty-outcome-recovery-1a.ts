/**
 * AVA-DISCOVERY-SLICE-EMPTY-OUTCOME-RECOVERY-1A — Empty-outcome slice persistence certification.
 * Run: pnpm test:ava-discovery-slice-empty-outcome-recovery-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  DISCOVERY_SLICE_CONSECUTIVE_LOW_NOVELTY_FOR_EXHAUSTION,
  DISCOVERY_SLICE_MAX_TOPIC_VARIANTS,
  emptyDatamoonDiscoverySearchSliceState,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import {
  isTrustworthyCompletedDatamoonSearchForSliceOutcome,
  recordDatamoonDiscoverySearchSliceOutcome,
  resolveDatamoonDiscoverySearchSliceOutcomeKind,
  selectNextDatamoonDiscoverySearchSlice,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a"

const CERT_ID = "ava-discovery-slice-empty-outcome-recovery-1a-v1" as const
const GENERATED_AT = "2026-07-27T18:40:00.000Z"
const SLICE_KEY = "commercial_kitchen_fleet:us_midwest"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function runGate(label: string, fn: () => void): void {
  fn()
  console.log(`  ✓ ${label}`)
}

function equipifyProjection() {
  return projectApprovedBusinessProfileToLeadDiscovery(
    buildLive1bEquipifyCompanyProfileContent(),
    "Equipify",
  )
}

function recordZeroSelected(input: {
  state?: ReturnType<typeof emptyDatamoonDiscoverySearchSliceState>
  topicVariantIndex?: number
  rawCompanyCount?: number
  normalizedCompanyCount?: number
}) {
  const state = input.state ?? emptyDatamoonDiscoverySearchSliceState()
  return recordDatamoonDiscoverySearchSliceOutcome({
    state: { ...state, currentSliceKey: SLICE_KEY },
    selection: {
      sliceKey: SLICE_KEY,
      clusterId: "commercial_kitchen_fleet",
      geoBucketId: "us_midwest",
      topicVariantIndex: input.topicVariantIndex ?? 0,
    },
    generatedAt: GENERATED_AT,
    selectedCount: 0,
    pushedCount: 0,
    existingCount: 0,
    rawCompanyCount: input.rawCompanyCount,
    normalizedCompanyCount: input.normalizedCompanyCount,
  })
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] certification`)

  runGate("1. preview=0 completed run persists outcome", () => {
    const state = recordZeroSelected({ rawCompanyCount: 0, normalizedCompanyCount: 0 })
    const outcome = state.slices[SLICE_KEY]
    assert.ok(outcome)
    assert.equal(outcome.lastSelectedCount, 0)
    assert.equal(outcome.lastPushedCount, 0)
    assert.equal(outcome.lastOutcomeKind, "zero_provider_results")
    assert.equal(state.currentSliceKey, SLICE_KEY)
    assert.equal(Object.keys(state.slices).length, 1)
  })

  runGate("2. selected=0 completed run persists outcome", () => {
    const state = recordZeroSelected({
      rawCompanyCount: 12,
      normalizedCompanyCount: 0,
    })
    const outcome = state.slices[SLICE_KEY]
    assert.ok(outcome)
    assert.equal(outcome.lastOutcomeKind, "zero_after_normalization")
    assert.equal(outcome.consecutiveLowNoveltyRuns, 1)
  })

  runGate("3. all-duplicate run persists zero novelty", () => {
    const state = recordDatamoonDiscoverySearchSliceOutcome({
      state: { ...emptyDatamoonDiscoverySearchSliceState(), currentSliceKey: SLICE_KEY },
      selection: {
        sliceKey: SLICE_KEY,
        clusterId: "commercial_kitchen_fleet",
        geoBucketId: "us_midwest",
        topicVariantIndex: 0,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 8,
      pushedCount: 0,
      existingCount: 8,
    })
    const outcome = state.slices[SLICE_KEY]
    assert.ok(outcome)
    assert.equal(resolveDatamoonDiscoverySearchSliceOutcomeKind({
      selectedCount: 8,
      pushedCount: 0,
      existingCount: 8,
    }), "duplicate_exhaustion")
    assert.equal(outcome.lastOutcomeKind, "duplicate_exhaustion")
    assert.equal(outcome.lastPushedCount, 0)
    assert.equal(outcome.consecutiveLowNoveltyRuns, 1)
  })

  runGate("4. successful novel intake persists positive novelty", () => {
    const state = recordDatamoonDiscoverySearchSliceOutcome({
      state: { ...emptyDatamoonDiscoverySearchSliceState(), currentSliceKey: SLICE_KEY },
      selection: {
        sliceKey: SLICE_KEY,
        clusterId: "commercial_kitchen_fleet",
        geoBucketId: "us_midwest",
        topicVariantIndex: 0,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 10,
      pushedCount: 3,
      existingCount: 7,
    })
    const outcome = state.slices[SLICE_KEY]
    assert.ok(outcome)
    assert.equal(outcome.lastOutcomeKind, "novel_intake")
    assert.equal(outcome.consecutiveLowNoveltyRuns, 0)
    assert.equal(outcome.lastNoveltyRate, 0.3)
  })

  runGate("5. provider failure does NOT count against slice", () => {
    assert.equal(
      isTrustworthyCompletedDatamoonSearchForSliceOutcome({
        datamoonJobActive: false,
        datamoonStopReason: "datamoon_disabled",
        datamoonRunId: null,
      }),
      false,
    )
    assert.equal(
      isTrustworthyCompletedDatamoonSearchForSliceOutcome({
        datamoonJobActive: false,
        datamoonStopReason: "datamoon_provider_error",
        datamoonRunId: "run-failed",
      }),
      false,
    )
    const portfolioSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
    assert.match(portfolioSource, /isTrustworthyCompletedDatamoonSearchForSliceOutcome/)
    assert.match(portfolioSource, /maybePersistSliceOutcome/)
  })

  runGate("6. incomplete poll does NOT count against slice", () => {
    assert.equal(
      isTrustworthyCompletedDatamoonSearchForSliceOutcome({
        datamoonJobActive: true,
        datamoonStopReason: "datamoon_request_active",
        datamoonRunId: "run-active",
      }),
      false,
    )
    assert.equal(
      isTrustworthyCompletedDatamoonSearchForSliceOutcome({
        datamoonJobActive: false,
        datamoonStopReason: null,
        datamoonRunId: null,
        intakeTerminalized: false,
      }),
      false,
    )
    assert.equal(
      isTrustworthyCompletedDatamoonSearchForSliceOutcome({
        datamoonJobActive: false,
        datamoonStopReason: null,
        datamoonRunId: "7066",
      }),
      true,
    )
  })

  runGate("7. zero provider results rotate immediately to a different slice", () => {
    let state = recordZeroSelected({ rawCompanyCount: 0, normalizedCompanyCount: 0, topicVariantIndex: 2 })
    assert.equal(state.slices[SLICE_KEY]?.lastOutcomeKind, "zero_provider_results")
    assert.ok(state.slices[SLICE_KEY]?.exhaustedUntil)

    const next = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: GENERATED_AT,
    })
    assert.notEqual(next.sliceKey, SLICE_KEY)
    assert.equal(next.topicVariantIndex, 0)
  })

  runGate("8. repeated low-novelty attempts still advance rotation/exhaustion", () => {
    let state = emptyDatamoonDiscoverySearchSliceState()
    state.currentSliceKey = SLICE_KEY
    state = recordZeroSelected({
      state,
      topicVariantIndex: 0,
      rawCompanyCount: 12,
      normalizedCompanyCount: 0,
    })
    assert.equal(state.slices[SLICE_KEY]?.lastOutcomeKind, "zero_after_normalization")
    assert.equal(state.slices[SLICE_KEY]?.consecutiveLowNoveltyRuns, 1)
    assert.equal(state.slices[SLICE_KEY]?.exhaustedUntil, null)

    const afterFirst = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: GENERATED_AT,
    })
    assert.equal(afterFirst.sliceKey, SLICE_KEY)
    assert.equal(afterFirst.topicVariantIndex, 1)

    state = recordZeroSelected({
      state,
      topicVariantIndex: 1,
      rawCompanyCount: 12,
      normalizedCompanyCount: 0,
    })
    assert.equal(state.slices[SLICE_KEY]?.consecutiveLowNoveltyRuns, 2)

    for (let variant = 2; variant < DISCOVERY_SLICE_MAX_TOPIC_VARIANTS; variant += 1) {
      state = recordZeroSelected({
        state,
        topicVariantIndex: variant,
        rawCompanyCount: 12,
        normalizedCompanyCount: 0,
      })
    }
    assert.ok(state.slices[SLICE_KEY]?.exhaustedUntil)
    assert.ok(
      (state.slices[SLICE_KEY]?.consecutiveLowNoveltyRuns ?? 0) >=
        DISCOVERY_SLICE_CONSECUTIVE_LOW_NOVELTY_FOR_EXHAUSTION,
    )
  })

  runGate("9. nextSearchSlice advances topic variants for post-normalization zero-result attempts", () => {
    let state = recordZeroSelected({ rawCompanyCount: 12, normalizedCompanyCount: 0 })
    const firstNext = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: GENERATED_AT,
    })
    assert.equal(firstNext.sliceKey, SLICE_KEY)
    assert.equal(firstNext.topicVariantIndex, 1)

    state = recordZeroSelected({
      state,
      topicVariantIndex: 1,
      rawCompanyCount: 12,
      normalizedCompanyCount: 0,
    })
    const secondNext = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: GENERATED_AT,
    })
    assert.equal(secondNext.sliceKey, SLICE_KEY)
    assert.equal(secondNext.topicVariantIndex, 2)
    assert.notEqual(
      `${firstNext.sliceKey}:${firstNext.topicVariantIndex}`,
      `${secondNext.sliceKey}:${secondNext.topicVariantIndex}`,
    )
  })

  runGate("10. existing successful discovery behavior remains intact", () => {
    const state = recordDatamoonDiscoverySearchSliceOutcome({
      state: { ...emptyDatamoonDiscoverySearchSliceState(), currentSliceKey: SLICE_KEY },
      selection: {
        sliceKey: SLICE_KEY,
        clusterId: "commercial_kitchen_fleet",
        geoBucketId: "us_midwest",
        topicVariantIndex: 0,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 10,
      pushedCount: 4,
      existingCount: 6,
    })
    const next = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: GENERATED_AT,
    })
    assert.equal(next.sliceKey, SLICE_KEY)
    assert.equal(next.topicVariantIndex, 0)
    assert.equal(next.resumedSlice, true)
  })

  runGate("11. no approval/send behavior changes (source)", () => {
    const portfolioSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
    assert.doesNotMatch(portfolioSource, /approveFirstTouch|sendOutbound|delivery_attempts/i)
    assert.match(portfolioSource, /selected\.length === 0/)
    assert.doesNotMatch(portfolioSource, /selected\.length > 0[\s\S]{0,120}recordDatamoonDiscoverySearchSliceOutcome/)
  })

  console.log(`\n[${CERT_ID}] PASS 11/11`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
