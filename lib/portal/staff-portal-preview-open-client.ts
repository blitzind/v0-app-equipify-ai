/**
 * Client-only helpers to open the staff portal preview bridge (`/api/portal/preview/start`).
 * Keeps internal URLs out of user-facing copy; callers should not toast raw API paths.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function buildStaffPortalPreviewBridgeUrl(
  origin: string,
  organizationId: string,
  customerId?: string | null,
): string | null {
  const oid = organizationId.trim()
  if (!UUID_RE.test(oid)) return null
  const u = new URL("/api/portal/preview/start", origin)
  u.searchParams.set("organizationId", oid)
  const cid = customerId?.trim() ?? ""
  if (cid && UUID_RE.test(cid)) u.searchParams.set("customerId", cid)
  return u.toString()
}

/**
 * Opens preview in a new tab when the browser allows it.
 *
 * Uses `window.open(url, "_blank")` **without** `noopener` so the return value distinguishes
 * a blocked popup (`null`) from a successful open (`Window`). The bridge URL is same-origin
 * and immediately redirects to `/portal/preview`.
 *
 * When this returns `"blocked"`, callers should offer same-tab navigation (e.g. a button in a
 * dialog) without surfacing raw `/api/...` URLs in toasts.
 */
export function tryOpenStaffPortalPreviewInNewTab(input: {
  organizationId: string
  customerId?: string | null
}): { ok: true; url: string } | { ok: false; url: string | null } {
  if (typeof window === "undefined") return { ok: false, url: null }
  const url = buildStaffPortalPreviewBridgeUrl(window.location.origin, input.organizationId, input.customerId)
  if (!url) return { ok: false, url: null }
  const win = window.open(url, "_blank")
  if (win == null) return { ok: false, url }
  return { ok: true, url }
}

export function navigateStaffPortalPreviewSameTab(url: string): void {
  if (typeof window === "undefined" || !url) return
  window.location.assign(url)
}
