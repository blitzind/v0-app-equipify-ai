/** Client-safe Lemlist provider labels (Growth Engine slice 6.15A). */

export const LEMLIST_PROVIDER_KEY = "lemlist" as const

export const LEMLIST_PROVIDER_DISPLAY_NAME = "Lemlist" as const

export const LEMLIST_WEBHOOK_VERIFICATION_NOTE =
  "Lemlist does not provide HMAC signatures. Use the shared webhook secret in the callback URL and configure the same secret in Lemlist webhook settings." as const

export const LEMLIST_AUTO_LAUNCH_WARNING =
  "This Lemlist campaign is running. Approved outreach will add leads to an active sequence and may auto-launch emails per Lemlist campaign settings." as const
