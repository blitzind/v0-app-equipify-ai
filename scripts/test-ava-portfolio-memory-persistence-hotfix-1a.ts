/**
 * AVA-PORTFOLIO-MEMORY-PERSISTENCE-HOTFIX-1A — Portfolio memory persistence certification.
 * Run: pnpm test:ava-portfolio-memory-persistence-hotfix-1a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  emptyDatamoonDiscoverySearchSliceState,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import {
  isTrustworthyCompletedDatamoonSearchForSliceOutcome,
  recordDatamoonDiscoverySearchSliceOutcome,
  selectNextDatamoonDiscoverySearchSlice,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a"
import { mergeDiscoverySearchSliceIntoPortfolioMemory } from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-state-1a"
import {
  emptyPortfolioManagerMemory,
  isValidOrganizationMemoryPreferenceImportance,
  portfolioManagerMemoryPreferencePayload,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import {
  GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MAX,
  GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MIN,
  GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_IMPORTANCE,
  GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

const CERT_ID = "ava-portfolio-memory-persistence-hotfix-1a-v1" as const
const ORG = "00757488-1026-44a5-aac4-269533ac21be"
const GENERATED_AT = "2026-07-27T21:00:00.000Z"
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

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] certification`)

  runGate("1. portfolio memory importance is within canonical DB range (1–5)", () => {
    const payload = portfolioManagerMemoryPreferencePayload(
      ORG,
      emptyPortfolioManagerMemory(),
      GENERATED_AT,
    )
    assert.equal(payload.importance, GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_IMPORTANCE)
    assert.equal(payload.importance, 5)
    assert.ok(isValidOrganizationMemoryPreferenceImportance(payload.importance))
    assert.equal(isValidOrganizationMemoryPreferenceImportance(90), false)
    assert.equal(GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MIN, 1)
    assert.equal(GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MAX, 5)
    const migration = readSource("supabase/migrations/20270830140000_ge_aios_17b_server_organizational_memory.sql")
    assert.match(migration, /importance integer not null default 3 check \(importance >= 1 and importance <= 5\)/)
  })

  runGate("2. portfolio memory payload shape matches org preference contract", () => {
    const payload = portfolioManagerMemoryPreferencePayload(ORG, emptyPortfolioManagerMemory(), GENERATED_AT)
    assert.equal(payload.key, GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY)
    assert.equal(payload.source, "sales_specialist")
    assert.ok(JSON.parse(payload.statement))
  })

  runGate("3. zero-result completed search persists slice outcome in memory model", () => {
    let memory = emptyPortfolioManagerMemory()
    const sliceState = recordDatamoonDiscoverySearchSliceOutcome({
      state: { ...emptyDatamoonDiscoverySearchSliceState(), currentSliceKey: SLICE_KEY },
      selection: {
        sliceKey: SLICE_KEY,
        clusterId: "commercial_kitchen_fleet",
        geoBucketId: "us_midwest",
        topicVariantIndex: 0,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 0,
      pushedCount: 0,
      existingCount: 0,
      rawCompanyCount: 0,
    })
    memory = mergeDiscoverySearchSliceIntoPortfolioMemory(memory, sliceState)
    assert.equal(Object.keys(sliceState.slices).length, 1)
    assert.equal(memory.discoverySearchSliceState?.slices[SLICE_KEY]?.lastOutcomeKind, "zero_provider_results")
  })

  runGate("4. sliceCount increments after outcome persistence", () => {
    const sliceState = recordDatamoonDiscoverySearchSliceOutcome({
      state: emptyDatamoonDiscoverySearchSliceState(),
      selection: {
        sliceKey: SLICE_KEY,
        clusterId: "commercial_kitchen_fleet",
        geoBucketId: "us_midwest",
        topicVariantIndex: 0,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 0,
      pushedCount: 0,
      existingCount: 0,
      rawCompanyCount: 0,
    })
    assert.equal(Object.keys(sliceState.slices).length, 1)
  })

  runGate("5. currentSearchSlice becomes populated via lastDiscoverySearchSliceSelection", () => {
    const selection = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state: emptyDatamoonDiscoverySearchSliceState(),
      generatedAt: GENERATED_AT,
    })
    const memory = {
      ...emptyPortfolioManagerMemory(),
      lastDiscoverySearchSliceSelection: selection,
    }
    assert.ok(memory.lastDiscoverySearchSliceSelection)
    assert.equal(memory.lastDiscoverySearchSliceSelection.sliceKey, SLICE_KEY)
  })

  runGate("6. consecutiveLowNoveltyRuns increments on zero-result outcome", () => {
    const sliceState = recordDatamoonDiscoverySearchSliceOutcome({
      state: emptyDatamoonDiscoverySearchSliceState(),
      selection: {
        sliceKey: SLICE_KEY,
        clusterId: "commercial_kitchen_fleet",
        geoBucketId: "us_midwest",
        topicVariantIndex: 0,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 0,
      pushedCount: 0,
      existingCount: 0,
      rawCompanyCount: 0,
    })
    assert.equal(sliceState.slices[SLICE_KEY]?.consecutiveLowNoveltyRuns, 1)
  })

  runGate("7. nextSearchSlice advances topic variant after low novelty", () => {
    const state = recordDatamoonDiscoverySearchSliceOutcome({
      state: { ...emptyDatamoonDiscoverySearchSliceState(), currentSliceKey: SLICE_KEY },
      selection: {
        sliceKey: SLICE_KEY,
        clusterId: "commercial_kitchen_fleet",
        geoBucketId: "us_midwest",
        topicVariantIndex: 0,
      },
      generatedAt: GENERATED_AT,
      selectedCount: 0,
      pushedCount: 0,
      existingCount: 0,
      rawCompanyCount: 0,
    })
    const next = selectNextDatamoonDiscoverySearchSlice({
      projection: equipifyProjection(),
      state,
      generatedAt: GENERATED_AT,
    })
    assert.equal(next.sliceKey, SLICE_KEY)
    assert.equal(next.topicVariantIndex, 1)
  })

  runGate("8. provider failures still do not penalize a slice", () => {
    assert.equal(
      isTrustworthyCompletedDatamoonSearchForSliceOutcome({
        datamoonJobActive: false,
        datamoonStopReason: "datamoon_disabled",
        datamoonRunId: null,
      }),
      false,
    )
  })

  runGate("9. successful novel intake behavior remains intact", () => {
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
      pushedCount: 3,
      existingCount: 5,
    })
    assert.equal(state.slices[SLICE_KEY]?.consecutiveLowNoveltyRuns, 0)
    assert.equal(state.slices[SLICE_KEY]?.lastOutcomeKind, "novel_intake")
  })

  runGate("10. persistence path uses observable helper, no silent .catch(() => 0) (source)", () => {
    const discoverySource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
    const sliceSource = readSource("lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-state-1a.ts")
    const persistenceSource = readSource(
      "lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-persistence-1a.ts",
    )
    assert.match(discoverySource, /persistPortfolioManagerMemoryPreferences/)
    assert.match(sliceSource, /persistPortfolioManagerMemoryPreferences/)
    assert.match(persistenceSource, /portfolio_manager_memory_persisted/)
    assert.match(persistenceSource, /portfolio_manager_memory_persist_failed/)
    assert.doesNotMatch(discoverySource, /\.catch\(\(\) => 0\)/)
    assert.doesNotMatch(sliceSource, /\.catch\(\(\) => 0\)/)
    assert.doesNotMatch(discoverySource, /approveFirstTouch|sendOutbound|delivery_attempts/i)
  })

  console.log(`\n[${CERT_ID}] PASS 10/10`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
