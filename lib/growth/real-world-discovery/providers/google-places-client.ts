import "server-only"

import type {
  GooglePlacesTextSearchPlace,
  GooglePlacesTextSearchResponse,
} from "@/lib/growth/real-world-discovery/providers/google-places-types"

const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.googleMapsUri",
].join(",")

export function getGooglePlacesApiKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim()
  return key || null
}

export async function searchGooglePlacesText(
  textQuery: string,
  options?: { limit?: number; apiKey?: string },
): Promise<GooglePlacesTextSearchPlace[]> {
  const apiKey = options?.apiKey ?? getGooglePlacesApiKey()
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured.")
  }

  const pageSize = Math.min(Math.max(options?.limit ?? 20, 1), 20)

  const res = await fetch(TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      pageSize,
      languageCode: "en",
    }),
  })

  const payload = (await res.json()) as GooglePlacesTextSearchResponse

  if (!res.ok) {
    const message =
      payload.error?.message ??
      (typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `Google Places request failed (${res.status}).`)
    throw new Error(message)
  }

  return payload.places ?? []
}
