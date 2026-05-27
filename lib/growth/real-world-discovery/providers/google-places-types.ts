/** Growth Engine — Google Places provider types (Real-World Discovery). */

export const GROWTH_GOOGLE_PLACES_PROVIDER_QA_MARKER =
  "growth-google-places-provider-v1" as const

export type GooglePlacesAddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
  languageCode?: string
}

export type GooglePlacesTextSearchPlace = {
  id?: string
  displayName?: { text?: string; languageCode?: string }
  formattedAddress?: string
  addressComponents?: GooglePlacesAddressComponent[]
  nationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  types?: string[]
  googleMapsUri?: string
}

export type GooglePlacesTextSearchResponse = {
  places?: GooglePlacesTextSearchPlace[]
  error?: { message?: string; status?: string }
}
