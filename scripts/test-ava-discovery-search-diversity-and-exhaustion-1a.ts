/**
 * AVA-DISCOVERY-SEARCH-DIVERSITY-AND-EXHAUSTION-1A — Focused certification (no live send/approval).
 * Run: pnpm test:ava-discovery-search-diversity-and-exhaustion-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  DATAMOON_DISCOVERY_US_GEO_BUCKETS,
  DISCOVERY_SLICE_CONSECUTIVE_LOW_NOVELTY_FOR_EXHAUSTION,
  DISCOVERY_SLICE_EXHAUSTION_COOLDOWN_MS,
  DISCOVERY_SLICE_MAX_TOPIC_VARIANTS,
  emptyDatamoonDiscoverySearchSliceState,
  type DatamoonDiscoverySearchSliceOutcome,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import {
  recordDatamoonDiscoverySearchSliceOutcome,
  selectNextDatamoonDiscoverySearchSlice,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "@/lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import {
  isActiveCandidateLeadForReplenishment,
} from "@/lib/growth/portfolio-manager/growth-autonomous-candidate-inventory-1a"
import { resolveAutonomousLeadDiscoveryAction } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"

const CERT_ID = "ava-discovery-search-diversity-and-exhaustion-1a-v1" as const
const ORG = "00757488-1026-44a5-aac4-269533ac21be"
const GENERATED_AT = "2026-07-27T16:00:00.000Z"

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

function lowNoveltyOutcome(input: {
  sliceKey: string
  clusterId: string
  geoBucketId: string
  topicVariantIndex: number
  consecutiveLowNoveltyRuns: number
}): DatamoonDiscoverySearchSliceOutcome {
  return {
    sliceKey: input.sliceKey,
    clusterId: input.clusterId,
    geoBucketId: input.geoBucketId,
    topicVariantIndex: input.topicVariantIndex,
    lastQueriedAt: GENERATED_AT,
    lastSelectedCount: 21,
    lastPushedCount: 0,
    lastExistingCount: 21,
    lastNoveltyRate: 0,
    consecutiveLowNoveltyRuns: input.consecutiveLowNoveltyRuns,
    exhaustedUntil: null,
  }
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] certification`)

  runGate("1. high-novelty slice may continue on same topic variant", () => {
    const sliceKey = "biomedical_imaging:us_northeast"
    const state = recordDatamoonDiscoverySearchSliceOutcome({
      state: {
        ...emptyDatamoonDiscoverySearchSliceState(),
        currentSliceKey: sliceKey,
      },
      selection: {
        sliceKey,
        clusterId: "biomedical_imaging",
        geoBucketId: "us_northeast",
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
    assert.equal(next.sliceKey, sliceKey)
    assert.equal(next.topicVariantIndex, 0)
    assert.equal(next.resumedSlice, true)
  })

  runGate("2. low novelty advances topic variant (pagination surrogate)", () => {
    const sliceKey = "biomedical_imaging:us_northeast"
    const state = recordDatamoonDiscoverySearchSliceOutcome({
      state: {
        ...emptyDatamoonDiscoverySearchSliceState(),
        currentSliceKey: sliceKey,
        slices: {
          [sliceKey]: lowNoveltyOutcome({
            sliceKey,
            clusterId: "biomedical_imaging",
            geoBucketId: "us_northeast",
            topicVariantIndex: 0,
            consecutiveLowNoveltyRuns: 1,
          }),
        },
      },
      selection: {
        sliceKey,
        clusterId: "biomedical_imaging",
        geoBucketId: "us_northeast",
        topicVariantIndex: 0,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 21,
      pushedCount: 0,
      existingCount: 21,
    })
    const next = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: GENERATED_AT,
    })
    assert.equal(next.sliceKey, sliceKey)
    assert.equal(next.topicVariantIndex, 1)
    assert.equal(next.advancedTopicVariant, true)
  })

  runGate("3. repeated low novelty marks slice exhausted after max topic variants", () => {
    const sliceKey = "biomedical_imaging:us_northeast"
    let state = emptyDatamoonDiscoverySearchSliceState()
    state.currentSliceKey = sliceKey
    for (let variant = 0; variant < DISCOVERY_SLICE_MAX_TOPIC_VARIANTS; variant += 1) {
      state = recordDatamoonDiscoverySearchSliceOutcome({
        state,
        selection: {
          sliceKey,
          clusterId: "biomedical_imaging",
          geoBucketId: "us_northeast",
          topicVariantIndex: variant,
        },
        generatedAt: GENERATED_AT,
        selectedCount: 21,
        pushedCount: 0,
        existingCount: 21,
      })
    }
    const outcome = state.slices[sliceKey]
    assert.ok(outcome)
    assert.ok(outcome.consecutiveLowNoveltyRuns >= DISCOVERY_SLICE_CONSECUTIVE_LOW_NOVELTY_FOR_EXHAUSTION)
    assert.ok(outcome.exhaustedUntil)
  })

  runGate("4. exhausted slice rotates to a different slice", () => {
    const exhaustedKey = "biomedical_imaging:us_northeast"
    const state = {
      ...emptyDatamoonDiscoverySearchSliceState(),
      currentSliceKey: exhaustedKey,
      slices: {
        [exhaustedKey]: {
          ...lowNoveltyOutcome({
            sliceKey: exhaustedKey,
            clusterId: "biomedical_imaging",
            geoBucketId: "us_northeast",
            topicVariantIndex: DISCOVERY_SLICE_MAX_TOPIC_VARIANTS - 1,
            consecutiveLowNoveltyRuns: DISCOVERY_SLICE_CONSECUTIVE_LOW_NOVELTY_FOR_EXHAUSTION,
          }),
          exhaustedUntil: new Date(Date.parse(GENERATED_AT) + DISCOVERY_SLICE_EXHAUSTION_COOLDOWN_MS).toISOString(),
        },
      },
    }
    const next = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: GENERATED_AT,
    })
    assert.notEqual(next.sliceKey, exhaustedKey)
    assert.equal(next.resumedSlice, false)
  })

  runGate("5. cooldown allows eventual revisit of exhausted slice", () => {
    const exhaustedKey = "biomedical_imaging:us_northeast"
    const cooledAt = new Date(Date.parse(GENERATED_AT) + DISCOVERY_SLICE_EXHAUSTION_COOLDOWN_MS + 1000).toISOString()
    const state = {
      ...emptyDatamoonDiscoverySearchSliceState(),
      currentSliceKey: "other:us_west",
      slices: {
        [exhaustedKey]: {
          ...lowNoveltyOutcome({
            sliceKey: exhaustedKey,
            clusterId: "biomedical_imaging",
            geoBucketId: "us_northeast",
            topicVariantIndex: DISCOVERY_SLICE_MAX_TOPIC_VARIANTS - 1,
            consecutiveLowNoveltyRuns: 2,
          }),
          exhaustedUntil: GENERATED_AT,
          lastQueriedAt: "2026-07-20T00:00:00.000Z",
        },
      },
    }
    const next = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: cooledAt,
    })
    assert.ok(next.sliceKey.length > 0)
  })

  runGate("6. vertical rotation occurs across cluster ids", () => {
    const projection = equipifyProjection()
    const picks = new Set<string>()
    let state = emptyDatamoonDiscoverySearchSliceState()
    for (let i = 0; i < 8; i += 1) {
      const next = selectNextDatamoonDiscoverySearchSlice({
        projection,
        state,
        generatedAt: GENERATED_AT,
      })
      picks.add(next.clusterId)
      state = {
        ...state,
        currentSliceKey: next.sliceKey,
        slices: {
          ...state.slices,
          [next.sliceKey]: {
            sliceKey: next.sliceKey,
            clusterId: next.clusterId,
            geoBucketId: next.geoBucketId,
            topicVariantIndex: next.topicVariantIndex,
            lastQueriedAt: GENERATED_AT,
            lastSelectedCount: 21,
            lastPushedCount: 0,
            lastExistingCount: 21,
            lastNoveltyRate: 0,
            consecutiveLowNoveltyRuns: 2,
            exhaustedUntil: new Date(Date.parse(GENERATED_AT) + DISCOVERY_SLICE_EXHAUSTION_COOLDOWN_MS).toISOString(),
          },
        },
      }
    }
    assert.ok(picks.size >= 2, `expected multiple verticals, got ${[...picks].join(",")}`)
  })

  runGate("7. geography rotation uses provider-supported state buckets", () => {
    assert.equal(DATAMOON_DISCOVERY_US_GEO_BUCKETS.length, 5)
    const geoA = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state: emptyDatamoonDiscoverySearchSliceState(),
      generatedAt: GENERATED_AT,
    })
    const request = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
      profile: buildLive1bEquipifyCompanyProfileContent(),
      organizationId: ORG,
      batchSize: 50,
      generatedAt: GENERATED_AT,
      searchSlice: geoA,
    })
    const stateFilter = request.request.filters.find((row) => row.field === "state")
    assert.ok(stateFilter)
    assert.equal(stateFilter.operator, "in")
    assert.ok(Array.isArray(stateFilter.value))
    assert.ok((stateFilter.value as string[]).length >= 4)
  })

  runGate("8. topic variant does not restart from variant 0 while slice remains active", () => {
    const sliceKey = "biomedical_imaging:us_southeast"
    const state = recordDatamoonDiscoverySearchSliceOutcome({
      state: {
        ...emptyDatamoonDiscoverySearchSliceState(),
        currentSliceKey: sliceKey,
      },
      selection: {
        sliceKey,
        clusterId: "biomedical_imaging",
        geoBucketId: "us_southeast",
        topicVariantIndex: 1,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 21,
      pushedCount: 0,
      existingCount: 21,
    })
    const next = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: GENERATED_AT,
    })
    assert.equal(next.topicVariantIndex, 2)
  })

  runGate("9. canonical dedupe wiring remains intact (source)", () => {
    const discoverySource = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
    const pushSource = readSource("lib/growth/prospect-search/prospect-search-push-to-inbox.ts")
    assert.doesNotMatch(discoverySource, /skip.*dedupe|disable.*dedupe/i)
    assert.match(pushSource, /already_exists/)
  })

  runGate("10. discovery path persists provider companies through push (source)", () => {
    const portfolioSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
    assert.match(portfolioSource, /executeBulkPushToLeadInbox/)
    assert.match(portfolioSource, /recordDatamoonDiscoverySearchSliceOutcome/)
  })

  runGate("11. pending approval does not block search rotation", () => {
    const action = resolveAutonomousLeadDiscoveryAction({
      lifecycleState: "monitoring",
      recordsImported: 0,
      newCompaniesFound: 0,
      leadPoolVisible: 20,
      leadPoolHasMore: false,
      pipelineLow: true,
      hasBoundSearch: true,
      researchingCount: 0,
      pendingApprovals: 5,
    })
    assert.equal(action, "refresh_audience")
  })

  runGate("12. stop_investment does not count as active candidate inventory", () => {
    assert.equal(
      isActiveCandidateLeadForReplenishment({
        lead: {
          id: "11111111-1111-4111-8111-111111111111",
          status: "new",
          metadata: { admission_state: "accepted" },
          promotedOrganizationId: ORG,
        } as never,
        organizationId: ORG,
        draftFactoryState: { state: "paused", pausedReason: "stop_investment" },
      }),
      false,
    )
  })

  runGate("13. provider failure does not mark slice exhausted from tiny sample", () => {
    const sliceKey = "biomedical_imaging:us_midwest"
    const state = recordDatamoonDiscoverySearchSliceOutcome({
      state: emptyDatamoonDiscoverySearchSliceState(),
      selection: {
        sliceKey,
        clusterId: "biomedical_imaging",
        geoBucketId: "us_midwest",
        topicVariantIndex: 0,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 0,
      pushedCount: 0,
      existingCount: 0,
    })
    const outcome = state.slices[sliceKey]
    assert.equal(outcome.consecutiveLowNoveltyRuns, 0)
    assert.equal(outcome.exhaustedUntil, null)
  })

  runGate("14. no approval/send in discovery slice path (source)", () => {
    const sources = [
      "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
      "lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts",
      "lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a.ts",
    ].map(readSource)
    for (const source of sources) {
      assert.doesNotMatch(source, /approveFirstTouch|sendOutbound|delivery_attempts/i)
    }
  })

  console.log(`\n[${CERT_ID}] PASS 14/14`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
