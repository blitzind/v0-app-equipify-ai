import {
  buildClickTrackingUrl,
  buildOpenTrackingUrl,
  createClickTrackingToken,
  createOpenTrackingToken,
  resolveTrackingBaseUrl,
} from "@/lib/growth/tracking/tracking-token"
import { injectTrackingPixel } from "@/lib/growth/tracking/tracking-pixel"

const TRACKING_URL_PATTERN = /href=(["'])(https?:\/\/[^"']+)\1/gi
const UNSAFE_URL_PATTERN = /^(javascript:|data:|file:|vbscript:)/i

export function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
    if (UNSAFE_URL_PATTERN.test(parsed.href)) return false
    return true
  } catch {
    return false
  }
}

export function rewriteHtmlLinksForTracking(
  html: string,
  input: {
    deliveryAttemptId: string
    baseUrl?: string
  },
): { html: string; clickTokenCount: number } {
  let clickTokenCount = 0
  const baseUrl = input.baseUrl

  const rewritten = html.replace(TRACKING_URL_PATTERN, (match, quote: string, url: string) => {
    if (!isSafeRedirectUrl(url)) return match
    const signedToken = createClickTrackingToken(input.deliveryAttemptId, url)
    clickTokenCount += 1
    const trackingUrl = buildClickTrackingUrl(signedToken, baseUrl)
    return `href=${quote}${trackingUrl}${quote}`
  })

  return { html: rewritten, clickTokenCount }
}

export function resolveClickDestinationFromToken(payload: {
  destinationUrl: string
}): string | null {
  if (!isSafeRedirectUrl(payload.destinationUrl)) return null
  return payload.destinationUrl
}

export function applyOutboundEmailTracking(input: {
  html?: string | null
  deliveryAttemptId: string
  baseUrl?: string
}): {
  html: string | undefined
  metadata: {
    tracking_enabled: boolean
    open_token_hint: string
    click_token_count: number
  }
} {
  const baseUrl = input.baseUrl ?? resolveTrackingBaseUrl()
  const openToken = createOpenTrackingToken(input.deliveryAttemptId)
  const openUrl = buildOpenTrackingUrl(openToken, baseUrl)
  const sourceHtml = input.html ?? ""
  const { html: rewritten, clickTokenCount } = rewriteHtmlLinksForTracking(sourceHtml, {
    deliveryAttemptId: input.deliveryAttemptId,
    baseUrl,
  })
  const withPixel = injectTrackingPixel(rewritten, openUrl)
  return {
    html: input.html == null && !withPixel.trim() ? undefined : withPixel,
    metadata: {
      tracking_enabled: true,
      open_token_hint: `${openToken.slice(0, 8)}…`,
      click_token_count: clickTokenCount,
    },
  }
}
