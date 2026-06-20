import { buildSendrPagePublicLink } from "@/lib/growth/sendr/growth-sendr-slug-runtime"
import { createSendrVisitorAccessToken } from "@/lib/growth/sendr/growth-sendr-visitor-token"

/** External recipient link — always tokenized, never exposes raw leadId. */
export function buildSendrPersonalizedVisitorLink(input: {
  slug: string
  landingPageId: string
  leadId: string
  origin?: string
  expiresAt?: Date
}): string {
  const token = createSendrVisitorAccessToken({
    leadId: input.leadId,
    landingPageId: input.landingPageId,
    expiresAt: input.expiresAt,
  })
  return buildSendrPagePublicLink(input.slug, input.origin, { token })
}

export function resolveSendrExternalPageUrl(input: {
  slug: string
  landingPageId: string
  leadId?: string | null
  origin?: string
  expiresAt?: Date
}): string {
  const leadId = input.leadId?.trim()
  if (leadId) {
    return buildSendrPersonalizedVisitorLink({
      slug: input.slug,
      landingPageId: input.landingPageId,
      leadId,
      origin: input.origin,
      expiresAt: input.expiresAt,
    })
  }
  return buildSendrPagePublicLink(input.slug, input.origin)
}
