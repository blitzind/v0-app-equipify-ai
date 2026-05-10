const DEFAULT_STAFF_PREVIEW_PATH = "/portal/preview"

/**
 * Builds a staff portal preview URL with `organizationId` and optional `customerId` query params.
 * Safe for server components (pure string logic, no React/client imports).
 */
export function buildStaffPreviewHref(
  organizationId: string,
  customerId: string | null,
  path: string = DEFAULT_STAFF_PREVIEW_PATH,
): string {
  const base = path?.trim() || DEFAULT_STAFF_PREVIEW_PATH
  const q = new URLSearchParams()
  q.set("organizationId", organizationId)
  if (customerId) q.set("customerId", customerId)
  return `${base}?${q.toString()}`
}
