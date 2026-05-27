/**
 * Regression checks for Territory Intelligence + Opportunity Maps.
 * Run: pnpm test:growth-territory-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { inferTerritoryType, buildTerritoryName } from "../lib/growth/territory-intelligence/territory-builder"
import {
  GROWTH_TERRITORY_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER,
} from "../lib/growth/territory-intelligence/territory-intelligence-types"
import { GROWTH_TERRITORY_INTELLIGENCE_SCHEMA_MIGRATION } from "../lib/growth/territory-intelligence/territory-intelligence-schema-health"
import {
  buildTerritoryClusters,
  buildTerritoryHeatmapPoints,
  buildTerritoryWhitespaceZones,
  companyTerritoryScoreBucket,
  computeTerritoryScoreMetrics,
  isHighFitProspect,
} from "../lib/growth/territory-intelligence/territory-scoring"
import { buildTerritoryIntelligenceSummary } from "../lib/growth/territory-intelligence/integrations/prospect-search-territory-overlay"

async function main(): Promise<void> {
  assert.equal(GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER, "growth-territory-intelligence-v1")
  assert.match(GROWTH_TERRITORY_INTELLIGENCE_PRIVACY_NOTE, /never guessed|never guess/i)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_TERRITORY_INTELLIGENCE_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.territories/)
  assert.match(migration, /territory_companies/)
  assert.match(migration, /territory_scores/)
  assert.match(migration, /territory_refresh_queue/)
  assert.match(migration, /is_mapped/)
  assert.doesNotMatch(migration, /geocode|google maps|mapbox/i)

  assert.equal(inferTerritoryType({ states: ["TN"] }), "state")
  assert.equal(
    inferTerritoryType({ radius: { center_lat: 36.16, center_lng: -86.78, miles: 25 } }),
    "radius",
  )
  assert.equal(inferTerritoryType({ postal_codes: ["37203"] }), "postal_code")
  assert.equal(inferTerritoryType({ cities: ["Nashville"] }), "city_metro")

  const name = buildTerritoryName({
    territory_filter: { states: ["TN"], cities: ["Nashville"] },
    industry: "HVAC",
  })
  assert.match(name, /TN/)
  assert.match(name, /HVAC/)

  const companies = [
    {
      company_id: "co-1",
      source_type: "growth_lead",
      company_name: "Mapped HVAC",
      lat: 36.16,
      lng: -86.78,
      state: "TN",
      city: "Nashville",
      lead_engine_score: 82,
      growth_signal_score: 75,
      contact_coverage_score: 70,
      is_existing_customer: false,
      is_existing_prospect: false,
      is_suppressed: false,
    },
    {
      company_id: "co-2",
      source_type: "growth_lead",
      company_name: "Unmapped Biomed",
      lat: null,
      lng: null,
      state: "TN",
      city: "Memphis",
      lead_engine_score: 68,
      growth_signal_score: 55,
      contact_coverage_score: 40,
      is_existing_customer: true,
      is_existing_prospect: false,
      is_suppressed: false,
    },
    {
      company_id: "co-3",
      source_type: "external_discovered",
      company_name: "High Signal Co",
      lat: 36.17,
      lng: -86.79,
      state: "TN",
      city: "Nashville",
      lead_engine_score: 90,
      growth_signal_score: 88,
      contact_coverage_score: 80,
      is_existing_customer: false,
      is_existing_prospect: false,
      is_suppressed: false,
    },
  ]

  assert.equal(companyTerritoryScoreBucket(companies[0]!), "high")
  assert.equal(companyTerritoryScoreBucket(companies[1]!), "unmapped")
  assert.ok(isHighFitProspect(companies[2]!))

  const heatmap = buildTerritoryHeatmapPoints(companies)
  assert.equal(heatmap.length, 2)
  assert.ok(heatmap.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)))

  const clusters = buildTerritoryClusters(companies)
  assert.ok(clusters.length >= 1)

  const whitespace = buildTerritoryWhitespaceZones(companies)
  assert.ok(whitespace.some((zone) => zone.high_fit_count > 0))

  const metrics = computeTerritoryScoreMetrics(companies)
  assert.equal(metrics.company_count, 3)
  assert.equal(metrics.mapped_company_count, 2)
  assert.equal(metrics.unmapped_company_count, 1)
  assert.ok(metrics.territory_opportunity_score >= 0 && metrics.territory_opportunity_score <= 100)
  assert.ok(metrics.whitespace_score >= 0)

  const summary = buildTerritoryIntelligenceSummary({
    territory_id: "terr-1",
    territory_name: "Nashville HVAC",
    score: { territory_id: "terr-1", last_computed_at: new Date().toISOString(), ...metrics },
  })
  assert.ok(summary)
  assert.equal(summary!.territory_opportunity_score, metrics.territory_opportunity_score)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/territory-intelligence/territory-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /refreshTerritoryIntelligence/)
  assert.match(repoSource, /loadTerritoryMapSnapshot/)
  assert.match(repoSource, /processTerritoryRefreshQueue/)
  assert.doesNotMatch(repoSource, /geocode|fake.*coord/i)

  const apiSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/territory-intelligence/route.ts"),
    "utf8",
  )
  assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
  assert.match(apiSource, /heatmap_points|loadTerritoryMapSnapshot/)

  const cronSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-territory-refresh/route.ts"),
    "utf8",
  )
  assert.match(cronSource, /CRON_SECRET|x-cron-secret/)
  assert.match(cronSource, /processTerritoryRefreshQueue/)

  const bridgeSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/territory-intelligence/integrations/prospect-search-bridge.ts"),
    "utf8",
  )
  assert.match(bridgeSource, /attachTerritoryIntelligenceToSearchResult/)
  assert.match(bridgeSource, /resolveTerritoryFilters/)

  const panelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/territory-intelligence-panel.tsx"),
    "utf8",
  )
  assert.match(panelSource, /growth-territory-intelligence-v1/)
  assert.match(panelSource, /unmapped/)
  assert.match(panelSource, /Save territory/)

  const actionsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-actions.ts"),
    "utf8",
  )
  assert.match(actionsSource, /save_territory/)
  assert.match(actionsSource, /push_territory_top_prospects/)

  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-repository.ts"),
    "utf8",
  )
  assert.match(repositorySource, /attachTerritoryIntelligenceToSearchResult/)

  console.log("growth-territory-intelligence-v1 checks passed")
}

void main()
