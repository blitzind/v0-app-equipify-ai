/** 1x1 transparent GIF — no third-party pixel dependencies. */

export const GROWTH_TRACKING_PIXEL_BYTES = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
)

export const GROWTH_TRACKING_PIXEL_CONTENT_TYPE = "image/gif"

export function trackingPixelResponseHeaders(): Record<string, string> {
  return {
    "Content-Type": GROWTH_TRACKING_PIXEL_CONTENT_TYPE,
    "Content-Length": String(GROWTH_TRACKING_PIXEL_BYTES.length),
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  }
}

export function buildTrackingPixelHtml(openTrackingUrl: string): string {
  return `<img src="${openTrackingUrl}" width="1" height="1" alt="" style="display:none!important;visibility:hidden!important;opacity:0!important;border:0!important" />`
}

export function injectTrackingPixel(html: string, openTrackingUrl: string): string {
  const pixel = buildTrackingPixelHtml(openTrackingUrl)
  if (!html.trim()) return pixel
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${pixel}</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${pixel}</html>`)
  return `${html}${pixel}`
}
