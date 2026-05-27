import type { GrowthRealWorldDiscoveryProviderRawCandidate } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import type { GooglePlacesTextSearchPlace } from "@/lib/growth/real-world-discovery/providers/google-places-types"

export function parseGooglePlaceId(placeId: string | undefined): string | null {
  if (!placeId) return null
  return placeId.startsWith("places/") ? placeId.slice("places/".length) : placeId
}

export function parseGooglePlacesAddressComponents(
  components: GooglePlacesTextSearchPlace["addressComponents"],
): { city: string | null; state: string | null; country: string | null } {
  let city: string | null = null
  let state: string | null = null
  let country: string | null = null

  for (const component of components ?? []) {
    const types = component.types ?? []
    if (!city && types.includes("locality")) {
      city = component.longText?.trim() || component.shortText?.trim() || null
    }
    if (!city && types.includes("postal_town")) {
      city = component.longText?.trim() || component.shortText?.trim() || null
    }
    if (!state && types.includes("administrative_area_level_1")) {
      state = component.shortText?.trim() || component.longText?.trim() || null
    }
    if (!country && types.includes("country")) {
      country = component.shortText?.trim() || component.longText?.trim() || null
    }
  }

  return { city, state, country }
}

export function formatGooglePlacesCategories(types: string[] | undefined): string | null {
  const cleaned = (types ?? [])
    .filter((t) => t && t !== "point_of_interest" && t !== "establishment")
    .map((t) => t.replace(/_/g, " "))
  if (!cleaned.length) return null
  return cleaned.slice(0, 3).join(", ")
}

function computeGooglePlacesConfidence(place: GooglePlacesTextSearchPlace): number {
  let confidence = 0.65
  if (place.websiteUri) confidence += 0.05
  if (typeof place.rating === "number" && place.rating >= 4) confidence += 0.05
  if (typeof place.userRatingCount === "number" && place.userRatingCount >= 10) confidence += 0.05
  return Math.min(0.85, confidence)
}

export function mapGooglePlaceToCandidate(
  place: GooglePlacesTextSearchPlace,
  input: { query: string; source_rank: number; matched_queries?: string[] },
): GrowthRealWorldDiscoveryProviderRawCandidate | null {
  const company_name = place.displayName?.text?.trim() ?? ""
  if (!company_name || company_name.length < 2) return null

  const google_place_id = parseGooglePlaceId(place.id)
  const { city, state, country } = parseGooglePlacesAddressComponents(place.addressComponents)
  const categories = (place.types ?? []).filter(
    (t) => t && t !== "point_of_interest" && t !== "establishment",
  )
  const category = formatGooglePlacesCategories(place.types)
  const address = place.formattedAddress?.trim() || null
  const location = [city, state, country].filter(Boolean).join(", ") || address
  const rating = typeof place.rating === "number" ? place.rating : null
  const review_count =
    typeof place.userRatingCount === "number" ? place.userRatingCount : null
  const confidence = computeGooglePlacesConfidence(place)
  const source_url = place.googleMapsUri?.trim() || null

  const ratingNote =
    rating != null
      ? ` Rating ${rating}${review_count != null ? ` (${review_count} reviews)` : ""}.`
      : ""

  return {
    company_name,
    website: place.websiteUri?.trim() || null,
    phone: place.nationalPhoneNumber?.trim() || null,
    address,
    city,
    state,
    country,
    category,
    location,
    rating,
    review_count,
    source_url,
    source_rank: input.source_rank,
    confidence,
    evidence: [
      {
        claim: "Google Places listing",
        evidence: `"${company_name}" returned by Google Places Text Search for "${input.query}".${ratingNote}`,
        source: "growth.real_world_discovery.google_places",
      },
    ],
    source_attribution: [
      {
        source: "growth.real_world_discovery.google_places",
        provider_type: "google_places",
        provider_name: "google_places",
        signal: "places_text_search",
        evidence: `Google Places Text Search — query "${input.query}".`,
        confidence,
      },
    ],
    raw_payload_server_only: {
      source_provider: "google_places",
      google_place_id,
      categories,
      google_maps_uri: source_url,
      matched_query: input.query,
      matched_queries: input.matched_queries ?? [input.query],
    },
  }
}
