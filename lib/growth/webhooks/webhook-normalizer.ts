import type { GrowthNormalizedProviderEvent } from "@/lib/growth/webhooks/webhook-types"
import { normalizeCustomWebhookPayload } from "@/lib/growth/webhooks/provider-normalizers/custom-normalizer"
import { normalizeGoogleWebhookPayload } from "@/lib/growth/webhooks/provider-normalizers/google-normalizer"
import { normalizeMicrosoftWebhookPayload } from "@/lib/growth/webhooks/provider-normalizers/microsoft-normalizer"
import { normalizeResendWebhookPayload } from "@/lib/growth/webhooks/provider-normalizers/resend-normalizer"
import { normalizeSesWebhookPayload } from "@/lib/growth/webhooks/provider-normalizers/ses-normalizer"
import { normalizeSmtpWebhookPayload } from "@/lib/growth/webhooks/provider-normalizers/smtp-normalizer"

export function normalizeProviderWebhookPayload(
  providerFamily: string,
  payload: Record<string, unknown>,
): GrowthNormalizedProviderEvent {
  switch (providerFamily) {
    case "google":
      return normalizeGoogleWebhookPayload(payload)
    case "microsoft":
      return normalizeMicrosoftWebhookPayload(payload)
    case "ses":
      return normalizeSesWebhookPayload(payload)
    case "resend":
      return normalizeResendWebhookPayload(payload)
    case "smtp":
      return normalizeSmtpWebhookPayload(payload)
    case "custom":
      return normalizeCustomWebhookPayload(payload)
    default:
      return normalizeCustomWebhookPayload(payload)
  }
}

export { mapWebhookEventType } from "@/lib/growth/webhooks/webhook-normalizer-utils"
