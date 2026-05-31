import "server-only"

import { getPublicAppOrigin } from "@/lib/email/config"

function readForwardedHeader(request: Request, name: string): string | null {
  const raw = request.headers.get(name)
  if (!raw) return null
  const first = raw.split(",")[0]?.trim()
  return first || null
}

/**
 * Twilio signs webhooks against the public URL configured in Console.
 * On Vercel/proxies, `request.url` can retain an internal hostname while
 * Twilio posts to the custom domain — causing signature validation to fail.
 */
export function resolveTwilioWebhookValidationUrl(request: Request): string {
  const url = new URL(request.url)
  const forwardedProto = readForwardedHeader(request, "x-forwarded-proto")
  const forwardedHost = readForwardedHeader(request, "x-forwarded-host")
  const hostHeader = readForwardedHeader(request, "host")

  if (forwardedProto && forwardedHost) {
    url.protocol = forwardedProto.endsWith(":") ? forwardedProto : `${forwardedProto}:`
    url.host = forwardedHost
    return url.toString()
  }

  if (hostHeader) {
    url.host = hostHeader
  }
  if (forwardedProto) {
    url.protocol = forwardedProto.endsWith(":") ? forwardedProto : `${forwardedProto}:`
  }

  const configuredOrigin = getPublicAppOrigin()
  let configuredHost: string | null = null
  try {
    configuredHost = new URL(configuredOrigin).host
  } catch {
    configuredHost = null
  }

  if (
    configuredHost &&
    url.host !== configuredHost &&
    /(?:\.vercel\.app|localhost|127\.0\.0\.1)/i.test(url.host)
  ) {
    const publicBase = new URL(configuredOrigin)
    url.protocol = publicBase.protocol
    url.host = publicBase.host
  }

  return url.toString()
}
