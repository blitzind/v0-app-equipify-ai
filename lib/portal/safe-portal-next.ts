/**
 * Safe `next` destinations after portal magic-link exchange.
 * Shared by the login client and server URL builders — keep this module free of server-only imports.
 */

const PORTAL_PREFIX = "/portal"

export function isSafePortalNextPath(next: string | null | undefined): boolean {
  if (typeof next !== "string") return false
  const t = next.trim()
  if (!t.startsWith(PORTAL_PREFIX)) return false
  if (t.startsWith("/portal/login")) return false
  if (t.startsWith("//")) return false
  if (t.includes("://")) return false
  if (t.includes("\\")) return false
  if (/[\s<>'"]/.test(t)) return false
  return true
}

export function sanitizePortalNext(next: string | null | undefined): string | null {
  const t = typeof next === "string" ? next.trim() : ""
  return isSafePortalNextPath(t) ? t : null
}

export function portalInvoicePath(invoiceId: string): string {
  return `/portal/invoices/${encodeURIComponent(invoiceId.trim())}`
}
