/**
 * GE-AIOS-DATAMOON-TOPIC-RANKING-NEUTRALIZATION-1A — Tenant-derived DataMoon B2B topic ranking certification.
 * Run: pnpm test:ge-aios-datamoon-topic-ranking-neutralization-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import Module from "node:module"
import path from "node:path"
import { projectApprovedBusinessProfileToLeadDiscovery } from "../lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  DATAMOON_B2B_TOPIC_RANKING_NEUTRAL_FALLBACK_NOTE,
  expandDatamoonB2bTopicSearchQueries,
  GROWTH_DATAMOON_B2B_TOPIC_RANKING_NEUTRALIZATION_1A_QA_MARKER,
  rankDatamoonB2bTopicCandidates,
  selectBroadenedDatamoonB2bTopics,
  type DatamoonB2bTopicCandidate,
} from "../lib/growth/lead-sources/datamoon/datamoon-b2b-topic-broadening"
import { translateDatamoonOperationalModelTargeting } from "../lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "../lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"

const PHASE = "GE-AIOS-DATAMOON-TOPIC-RANKING-NEUTRALIZATION-1A" as const
const ORG = "00757488-1026-44a5-aac4-269533ac21be"

const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load
;(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patchedLoad(
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {}
  return originalLoad.call(this, request, parent, isMain)
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseProfile(overrides: {
  companyName: string
  verticalIds: string[]
  targetIndustries: string[]
  keywords: string[]
  qualificationCriteria: string[]
  geography?: string[]
  buyerPersonas?: string[]
}): BusinessProfileDraftContent {
  return {
    company: {
      companyName: overrides.companyName,
      website: `https://${overrides.companyName.toLowerCase().replace(/\s+/g, "")}.example`,
      shortDescription: `${overrides.companyName} provides field service operations.`,
      productsServices: ["Field service operations"],
      businessModel: "B2B service",
      primaryValueProposition: "Reliable equipment service operations",
    },
    idealCustomers: {
      targetIndustries: overrides.targetIndustries,
      supportedServiceVerticals: overrides.verticalIds.map((id) => ({
        id,
        label: id.replace(/_/g, " "),
      })),
      companySizeRanges: ["11-50", "51-200"],
      geography: overrides.geography ?? ["United States"],
      buyerPersonas: overrides.buyerPersonas ?? ["owner", "operations manager", "service manager"],
      disqualifiers: [],
      preferredNaicsCodes: [],
      excludedNaicsCodes: [],
    },
    problemsAndTriggers: {
      painPoints: ["Dispatch complexity"],
      buyingTriggers: ["Growth"],
      competitorsAlternatives: [],
      keywords: overrides.keywords,
      negativeKeywords: [],
    },
    salesAndMarketing: {
      averageDealSize: null,
      salesCycleEstimate: null,
      messagingAngles: [],
      qualificationCriteria: overrides.qualificationCriteria,
    },
    confidence: { score: 0.9, assumptions: [], missingInformation: [] },
  }
}

const PROFILE_FIXTURES = {
  commercialHvac: baseProfile({
    companyName: "Summit HVAC",
    verticalIds: ["commercial_hvac", "hvac_r"],
    targetIndustries: ["Commercial HVAC service"],
    keywords: ["hvac maintenance", "commercial hvac"],
    qualificationCriteria: ["Runs preventive maintenance programs"],
    geography: ["Texas"],
  }),
  fireProtection: baseProfile({
    companyName: "Guardian Fire",
    verticalIds: ["fire_security"],
    targetIndustries: ["Fire protection service"],
    keywords: ["fire inspection", "sprinkler service"],
    qualificationCriteria: ["Maintains inspection documentation"],
    geography: ["Florida"],
  }),
  locksmith: baseProfile({
    companyName: "Metro Locksmith",
    verticalIds: ["locksmith"],
    targetIndustries: ["Locksmith service"],
    keywords: ["locksmith service", "access control"],
    qualificationCriteria: ["Dispatches field technicians"],
    geography: ["Ohio"],
  }),
  propertyManagement: baseProfile({
    companyName: "Harbor Property",
    verticalIds: ["property_management", "facility_maintenance"],
    targetIndustries: ["Property management"],
    keywords: ["facility maintenance", "property maintenance"],
    qualificationCriteria: ["Manages multi-site maintenance"],
    geography: ["Georgia"],
  }),
  commercialKitchen: baseProfile({
    companyName: "KitchenPro Service",
    verticalIds: ["commercial_kitchen"],
    targetIndustries: ["Commercial kitchen equipment service"],
    keywords: ["kitchen equipment repair", "restaurant equipment service"],
    qualificationCriteria: ["Services commercial kitchen equipment"],
    geography: ["Tennessee"],
  }),
  biomedical: baseProfile({
    companyName: "Precision Biomed",
    verticalIds: ["biomedical_equipment", "medical_equipment"],
    targetIndustries: ["Biomedical equipment service"],
    keywords: ["biomedical maintenance", "clinical equipment service"],
    qualificationCriteria: ["Maintains biomedical equipment with preventive maintenance"],
    geography: ["United States"],
  }),
  industrialEquipment: baseProfile({
    companyName: "Industrial Field Co",
    verticalIds: ["industrial_equipment", "material_handling"],
    targetIndustries: ["Industrial equipment service"],
    keywords: ["industrial maintenance", "material handling service"],
    qualificationCriteria: ["Runs preventive maintenance on industrial assets"],
    geography: ["North Carolina"],
  }),
} as const

function mockBroadTopicSearchFetch() {
  const responses: Record<string, Array<{ topic_id: string; label: string; match_score: number; match_method: string }>> = {
    "medical equipment service": [
      { topic_id: "29077", label: "Medical Equipment Management Plan", match_score: 81.1, match_method: "semantic" },
      { topic_id: "4690", label: "Medical Equipment", match_score: 80.7, match_method: "semantic" },
      { topic_id: "48172", label: "Industrial Equipment Maintenance", match_score: 77.4, match_method: "semantic" },
    ],
    "medical equipment": [{ topic_id: "4690", label: "Medical Equipment", match_score: 95, match_method: "semantic" }],
    "biomedical equipment maintenance": [
      { topic_id: "4690", label: "Medical Equipment", match_score: 92, match_method: "semantic" },
    ],
    "equipment calibration services": [
      { topic_id: "54001", label: "Equipment Calibration", match_score: 86, match_method: "semantic" },
    ],
    "clinical equipment service": [
      { topic_id: "4690", label: "Medical Equipment", match_score: 88, match_method: "semantic" },
    ],
    "preventive maintenance contracts": [
      { topic_id: "48175", label: "Large Machinery Maintenance", match_score: 85, match_method: "semantic" },
    ],
    "field service management": [
      { topic_id: "1897", label: "Field Service Management", match_score: 93, match_method: "semantic" },
    ],
    "commercial hvac maintenance": [
      { topic_id: "12001", label: "Commercial HVAC", match_score: 93, match_method: "semantic" },
      { topic_id: "1897", label: "Field Service Management", match_score: 88, match_method: "semantic" },
    ],
    "fire protection inspection": [
      { topic_id: "3936", label: "Safety Supplies", match_score: 90, match_method: "semantic" },
    ],
    "locksmith service": [{ topic_id: "55001", label: "Locksmith Services", match_score: 91, match_method: "semantic" }],
    "facility maintenance service": [
      { topic_id: "66001", label: "Facility Maintenance", match_score: 89, match_method: "semantic" },
    ],
    "commercial kitchen equipment service": [
      { topic_id: "77001", label: "Commercial Kitchen Equipment", match_score: 90, match_method: "semantic" },
    ],
    "industrial equipment maintenance": [
      { topic_id: "48172", label: "Industrial Equipment Maintenance", match_score: 94, match_method: "semantic" },
      { topic_id: "4690", label: "Medical Equipment", match_score: 70, match_method: "semantic" },
    ],
    "material handling service": [
      { topic_id: "88001", label: "Material Handling Equipment", match_score: 88, match_method: "semantic" },
    ],
  }

  return async (url: string | URL | Request) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url
    const keywords = new URL(href).searchParams.get("keywords") ?? ""
    const hits = responses[keywords] ?? []
    return new Response(JSON.stringify({ success: true, data: hits, total: hits.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}

function candidate(
  input: Omit<DatamoonB2bTopicCandidate, "searchQuery"> & { searchQuery?: string },
): DatamoonB2bTopicCandidate {
  return {
    ...input,
    searchQuery: input.searchQuery ?? input.originalQuery,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] topic ranking neutralization certification\n`)
  assert.equal(
    GROWTH_DATAMOON_B2B_TOPIC_RANKING_NEUTRALIZATION_1A_QA_MARKER,
    "ge-aios-datamoon-topic-ranking-neutralization-1a-v1",
  )

  const broadeningSource = readSource("lib/growth/lead-sources/datamoon/datamoon-b2b-topic-broadening.ts")
  const resolverSource = readSource("lib/growth/lead-sources/datamoon/datamoon-b2b-topic-resolver.ts")
  const prepareSource = readSource("lib/growth/lead-sources/datamoon/datamoon-b2b-audience-import-prepare.ts")
  const projectionSource = readSource(
    "lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a.ts",
  )

  assert.doesNotMatch(broadeningSource, /EQUIPIFY_ICP_B2B_TOPIC_PRIORITY_IDS/)
  assert.doesNotMatch(broadeningSource, /BROADENING_ANCHOR_QUERIES/)
  assert.match(broadeningSource, /rankDatamoonB2bTopicCandidates/)
  assert.match(broadeningSource, /DatamoonB2bTopicRankingSignals/)
  assert.match(prepareSource, /topicRankingSignals/)
  assert.match(projectionSource, /topicRankingSignals/)
  assert.match(resolverSource, /topicRankingSignals/)
  console.log("  ✓ runtime audit — Equipify topic priority heuristics removed from adapter")

  const equipifyProfile = buildLive1bEquipifyCompanyProfileContent()
  const equipifyProjection = projectApprovedBusinessProfileToLeadDiscovery(equipifyProfile, "Equipify")
  const equipifyMedicalOrdinal = (() => {
    for (let ordinal = 0; ordinal < 12; ordinal += 1) {
      const omt = translateDatamoonOperationalModelTargeting({
        projection: equipifyProjection,
        organizationId: ORG,
        audienceOrdinal: ordinal,
      })
      if (omt.operationalCluster === "Medical & Biomedical Equipment") return ordinal
    }
    return 0
  })()

  const equipifyRequest = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile: equipifyProfile,
    companyName: "Equipify",
    organizationId: ORG,
    batchSize: 25,
    generatedAt: "2026-07-16T12:00:00.000Z",
    audienceOrdinal: equipifyMedicalOrdinal,
  })

  assert.ok(equipifyRequest.request.workbench_context?.topicRankingSignals?.topicPhrases?.length)
  assert.ok(
    equipifyRequest.request.workbench_context?.topicRankingSignals?.operationalConceptPhrases?.length,
  )

  const equipifyRanked = rankDatamoonB2bTopicCandidates(
    [
      candidate({
        originalQuery: "medical equipment service",
        topic_id: "29077",
        label: "Medical Equipment Management Plan",
        match_score: 81.1,
        match_method: "semantic",
      }),
      candidate({
        originalQuery: "medical equipment",
        topic_id: "4690",
        label: "Medical Equipment",
        match_score: 80.7,
        match_method: "semantic",
        searchQuery: "medical equipment",
      }),
    ],
    equipifyRequest.request.workbench_context?.topicRankingSignals,
  )
  assert.equal(equipifyRanked[0]?.topic_id, "4690", "Equipify biomedical profile prefers broad equipment topic over narrow plan variant")
  console.log("  ✓ Equipify ranking preserved via tenant OMT signals (4690 before 29077)")

  const hvacRequest = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile: PROFILE_FIXTURES.commercialHvac,
    companyName: "Summit HVAC",
    organizationId: "org-hvac",
    batchSize: 25,
    generatedAt: "2026-07-16T12:00:00.000Z",
    audienceOrdinal: 0,
  })
  const fireRequest = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
    profile: PROFILE_FIXTURES.fireProtection,
    companyName: "Guardian Fire",
    organizationId: "org-fire",
    batchSize: 25,
    generatedAt: "2026-07-16T12:00:00.000Z",
    audienceOrdinal: 0,
  })

  assert.notDeepEqual(
    hvacRequest.request.workbench_context?.topicRankingSignals?.topicPhrases,
    fireRequest.request.workbench_context?.topicRankingSignals?.topicPhrases,
  )
  assert.notEqual(hvacRequest.fingerprint, fireRequest.fingerprint)
  console.log("  ✓ different Business Profiles produce different ranking signals")

  const multiCustomerResults: Array<{
    profile: string
    verticalIds: string[]
    cluster: string
    topicPhrases: string[]
    firstRankedTopicId: string
  }> = []

  for (const [key, profile] of Object.entries(PROFILE_FIXTURES)) {
    const projection = projectApprovedBusinessProfileToLeadDiscovery(profile, profile.company.companyName)
    const omt = translateDatamoonOperationalModelTargeting({
      projection,
      organizationId: `org-${key}`,
      audienceOrdinal: 0,
    })
    const request = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
      profile,
      companyName: profile.company.companyName,
      organizationId: `org-${key}`,
      batchSize: 25,
      generatedAt: "2026-07-16T12:00:00.000Z",
      audienceOrdinal: 0,
    })

    const primaryPhrase = omt.topicPhrases[0] ?? omt.resolvedTopicQueries[0] ?? ""
    const mockCandidates: DatamoonB2bTopicCandidate[] = [
      candidate({
        originalQuery: primaryPhrase,
        topic_id: `${key}-primary`,
        label: `${key} primary`,
        match_score: 70,
        match_method: "semantic",
      }),
      candidate({
        originalQuery: "medical equipment",
        topic_id: "4690",
        label: "Medical Equipment",
        match_score: 95,
        match_method: "semantic",
        searchQuery: "medical equipment",
      }),
    ]

    const ranked = rankDatamoonB2bTopicCandidates(
      mockCandidates,
      request.request.workbench_context?.topicRankingSignals,
    )
    multiCustomerResults.push({
      profile: key,
      verticalIds: omt.selectedVerticalIds,
      cluster: omt.operationalCluster,
      topicPhrases: omt.topicPhrases.slice(0, 3),
      firstRankedTopicId: ranked[0]?.topic_id ?? "",
    })

    if (key !== "biomedical" && key !== "medical_equipment") {
      assert.notEqual(
        ranked[0]?.topic_id,
        "4690",
        `${key} must not medical-first rank topic 4690 when profile is non-biomedical`,
      )
    }
  }

  const biomedicalResult = multiCustomerResults.find((row) => row.profile === "biomedical")
  assert.ok(biomedicalResult)
  assert.ok(
    biomedicalResult!.firstRankedTopicId === "4690" || biomedicalResult!.firstRankedTopicId === "biomedical-primary",
    "biomedical profile may rank Medical Equipment (4690) when it matches tenant signals",
  )
  console.log("  ✓ multi-customer validation — no medical-first bias outside biomedical profile")
  console.log(JSON.stringify({ multiCustomerResults }, null, 2))

  const neutralRanked = rankDatamoonB2bTopicCandidates([
    candidate({
      originalQuery: "unknown query",
      topic_id: "999",
      label: "Unknown",
      match_score: 50,
      match_method: "semantic",
    }),
    candidate({
      originalQuery: "unknown query",
      topic_id: "100",
      label: "Higher score unknown",
      match_score: 90,
      match_method: "semantic",
    }),
  ])
  assert.equal(neutralRanked[0]?.topic_id, "100")
  assert.match(DATAMOON_B2B_TOPIC_RANKING_NEUTRAL_FALLBACK_NOTE, /match_score/)
  console.log("  ✓ fail-closed neutral fallback uses provider match_score ordering")

  const broadenedHvac = expandDatamoonB2bTopicSearchQueries(hvacRequest.request.workbench_context?.topics ?? [], {
    clusterBroadeningAnchors: hvacRequest.request.workbench_context?.clusterBroadeningAnchors,
  })
  assert.ok(broadenedHvac.some((query) => /hvac/i.test(query)))
  assert.doesNotMatch(broadenedHvac.join(" "), /equipment maintenance software/i)
  console.log("  ✓ cluster broadening uses tenant anchors only (no Equipify medical fallback)")

  const { prepareDatamoonAudienceImportRequestForBuild } = await import(
    "../lib/growth/lead-sources/datamoon/datamoon-b2b-audience-import-prepare"
  )

  const equipifyPrepared = await prepareDatamoonAudienceImportRequestForBuild(equipifyRequest.request, {
    env: { ...process.env, DATAMOON_DRY_RUN_ONLY: "false" },
    fetchImpl: mockBroadTopicSearchFetch(),
  })
  assert.equal(equipifyPrepared.ok, true)
  if (!equipifyPrepared.ok) throw new Error("equipify prepare failed")
  assert.equal(equipifyPrepared.request.topic_ids?.[0], "4690")
  assert.ok((equipifyPrepared.request.topic_ids?.length ?? 0) >= 2)
  console.log("  ✓ production-style prepare replay — Equipify first topic remains biomedical-aligned without Equipify priority IDs")

  const industrialPrepared = await prepareDatamoonAudienceImportRequestForBuild(
    buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
      profile: PROFILE_FIXTURES.industrialEquipment,
      companyName: "Industrial Field Co",
      organizationId: "org-industrial",
      batchSize: 25,
      generatedAt: "2026-07-16T12:00:00.000Z",
      audienceOrdinal: 0,
    }).request,
    {
      env: { ...process.env, DATAMOON_DRY_RUN_ONLY: "false" },
      fetchImpl: mockBroadTopicSearchFetch(),
    },
  )
  assert.equal(industrialPrepared.ok, true)
  if (!industrialPrepared.ok) throw new Error("industrial prepare failed")
  assert.equal(industrialPrepared.request.topic_ids?.[0], "48172")
  assert.ok(!industrialPrepared.request.topic_ids?.includes("4690") || industrialPrepared.request.topic_ids[0] === "48172")
  console.log("  ✓ industrial profile ranks industrial topic first (48172)")

  const selected = selectBroadenedDatamoonB2bTopics(equipifyRanked, equipifyRequest.request.workbench_context?.topicRankingSignals)
  assert.equal(selected.topic_ids[0], "4690")
  console.log("  ✓ selectBroadenedDatamoonB2bTopics uses tenant ranking signals")

  console.log(`\nPASS ${GROWTH_DATAMOON_B2B_TOPIC_RANKING_NEUTRALIZATION_1A_QA_MARKER}`)
}

main().catch((error) => {
  console.error(`[${PHASE}] FAILED`, error)
  process.exit(1)
})
