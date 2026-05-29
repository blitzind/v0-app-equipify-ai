/** Geographic tiling for bulk acquisition discovery expansion. Client-safe. */

import { normalizeState, parseTerritoryInput } from "@/lib/growth/prospect-search/prospect-search-geo"

export const GROWTH_ACQUISITION_GEO_EXPANSION_QA_MARKER =
  "growth-acquisition-geo-expansion-v1" as const

export type AcquisitionGeoTileKind = "base" | "metro" | "county" | "region"

export type AcquisitionGeoTile = {
  label: string
  kind: AcquisitionGeoTileKind
}

type StateGeoExpansion = {
  metros: readonly string[]
  counties: readonly string[]
  regions: readonly string[]
}

const STATE_GEO_EXPANSIONS: Record<string, StateGeoExpansion> = {
  TN: {
    metros: [
      "Nashville TN",
      "Memphis TN",
      "Knoxville TN",
      "Chattanooga TN",
      "Clarksville TN",
      "Murfreesboro TN",
      "Franklin TN",
      "Johnson City TN",
    ],
    counties: [
      "Davidson County TN",
      "Shelby County TN",
      "Knox County TN",
      "Hamilton County TN",
      "Rutherford County TN",
      "Williamson County TN",
      "Sumner County TN",
      "Wilson County TN",
      "Montgomery County TN",
      "Blount County TN",
    ],
    regions: ["East Tennessee", "Middle Tennessee", "West Tennessee"],
  },
  TX: {
    metros: [
      "Houston TX",
      "Dallas TX",
      "San Antonio TX",
      "Austin TX",
      "Fort Worth TX",
      "El Paso TX",
    ],
    counties: [
      "Harris County TX",
      "Dallas County TX",
      "Tarrant County TX",
      "Bexar County TX",
      "Travis County TX",
    ],
    regions: ["North Texas", "South Texas", "East Texas", "West Texas"],
  },
  CA: {
    metros: [
      "Los Angeles CA",
      "San Francisco CA",
      "San Diego CA",
      "San Jose CA",
      "Sacramento CA",
      "Fresno CA",
    ],
    counties: [
      "Los Angeles County CA",
      "Orange County CA",
      "San Diego County CA",
      "Santa Clara County CA",
      "Alameda County CA",
    ],
    regions: ["Northern California", "Southern California", "Central California"],
  },
  FL: {
    metros: [
      "Miami FL",
      "Tampa FL",
      "Orlando FL",
      "Jacksonville FL",
      "Fort Lauderdale FL",
    ],
    counties: [
      "Miami-Dade County FL",
      "Broward County FL",
      "Palm Beach County FL",
      "Hillsborough County FL",
      "Orange County FL",
    ],
    regions: ["South Florida", "Central Florida", "North Florida"],
  },
  GA: {
    metros: ["Atlanta GA", "Savannah GA", "Augusta GA", "Columbus GA"],
    counties: ["Fulton County GA", "DeKalb County GA", "Gwinnett County GA", "Cobb County GA"],
    regions: ["North Georgia", "South Georgia"],
  },
  NC: {
    metros: ["Charlotte NC", "Raleigh NC", "Greensboro NC", "Durham NC"],
    counties: ["Mecklenburg County NC", "Wake County NC", "Guilford County NC"],
    regions: ["Western North Carolina", "Eastern North Carolina"],
  },
  OH: {
    metros: ["Columbus OH", "Cleveland OH", "Cincinnati OH", "Dayton OH"],
    counties: ["Franklin County OH", "Cuyahoga County OH", "Hamilton County OH"],
    regions: ["Northeast Ohio", "Southwest Ohio"],
  },
  PA: {
    metros: ["Philadelphia PA", "Pittsburgh PA", "Allentown PA"],
    counties: ["Philadelphia County PA", "Allegheny County PA", "Montgomery County PA"],
    regions: ["Eastern Pennsylvania", "Western Pennsylvania"],
  },
}

const STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
}

function cleanPart(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

function uniqueTileLabels(tiles: AcquisitionGeoTile[]): AcquisitionGeoTile[] {
  const seen = new Set<string>()
  const out: AcquisitionGeoTile[] = []
  for (const tile of tiles) {
    const label = tile.label.trim()
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...tile, label })
  }
  return out
}

function stateBaseLabel(stateAbbr: string): string {
  return STATE_ABBR_TO_NAME[stateAbbr] ?? stateAbbr
}

function appendStateSuffix(label: string, stateAbbr: string): string {
  const normalized = label.trim()
  if (!normalized) return stateBaseLabel(stateAbbr)
  const upper = normalized.toUpperCase()
  if (upper.includes(stateAbbr) || upper.includes(stateBaseLabel(stateAbbr).toUpperCase())) {
    return normalized
  }
  return `${normalized} ${stateAbbr}`.trim()
}

function expansionForState(stateAbbr: string): StateGeoExpansion {
  return (
    STATE_GEO_EXPANSIONS[stateAbbr] ?? {
      metros: [],
      counties: [],
      regions: [],
    }
  )
}

/** Expand a broad location (e.g. "Tennessee") into geo tiles for discovery. */
export function buildAcquisitionGeoTiles(location: string | null | undefined): AcquisitionGeoTile[] {
  const raw = cleanPart(location)
  if (!raw) {
    return [{ label: "United States", kind: "base" }]
  }

  const parsed = parseTerritoryInput(raw)
  const stateAbbr = parsed.states?.[0] ?? normalizeState(raw)
  const city = parsed.cities?.[0] ?? null

  if (city && stateAbbr) {
    return uniqueTileLabels([{ label: `${city} ${stateAbbr}`, kind: "base" }])
  }

  if (city && !stateAbbr) {
    return uniqueTileLabels([{ label: raw, kind: "base" }])
  }

  if (stateAbbr && STATE_ABBR_TO_NAME[stateAbbr]) {
    const expansion = expansionForState(stateAbbr)
    const base = stateBaseLabel(stateAbbr)
    const tiles: AcquisitionGeoTile[] = [{ label: base, kind: "base" }]

    for (const metro of expansion.metros) {
      tiles.push({ label: appendStateSuffix(metro, stateAbbr), kind: "metro" })
    }
    for (const county of expansion.counties) {
      tiles.push({ label: appendStateSuffix(county, stateAbbr), kind: "county" })
    }
    for (const region of expansion.regions) {
      tiles.push({ label: appendStateSuffix(region, stateAbbr), kind: "region" })
    }

    return uniqueTileLabels(tiles)
  }

  return uniqueTileLabels([{ label: raw, kind: "base" }])
}

export function acquisitionQueryDedupeKey(tileLabel: string, query: string): string {
  return `${tileLabel.trim().toLowerCase()}|${query.trim().toLowerCase()}`
}

export function currentAcquisitionGeoTile(
  geoTiles: string[],
  geoTileIndex: number,
): string | null {
  if (geoTileIndex < 0 || geoTileIndex >= geoTiles.length) return null
  return geoTiles[geoTileIndex] ?? null
}
