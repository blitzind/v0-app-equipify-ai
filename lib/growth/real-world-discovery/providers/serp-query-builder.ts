import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"
import { buildGooglePlacesDiscoveryQuery } from "@/lib/growth/real-world-discovery/providers/google-places-query-builder"

/** SERP Google Maps queries mirror concise ICP + location search strings. */
export function buildSerpDiscoveryQuery(inputs: GrowthRealWorldDiscoverySearchInputs): string {
  return buildGooglePlacesDiscoveryQuery(inputs)
}
