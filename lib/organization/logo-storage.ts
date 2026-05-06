/** Default bucket id from migration `organization_logos_storage`. */
export const ORGANIZATION_LOGOS_BUCKET_DEFAULT = "organization-logos"

/**
 * Single bucket id for all logo uploads (server).
 * Set `ORGANIZATION_LOGOS_BUCKET` if production uses a different bucket name than the default.
 */
export function getOrganizationLogosBucket(): string {
  const env =
    typeof process !== "undefined" && process.env?.ORGANIZATION_LOGOS_BUCKET?.trim()
      ? process.env.ORGANIZATION_LOGOS_BUCKET.trim()
      : ""
  return env || ORGANIZATION_LOGOS_BUCKET_DEFAULT
}

/** @deprecated Prefer {@link getOrganizationLogosBucket} — env override applies only to the getter. */
export const ORGANIZATION_LOGOS_BUCKET = ORGANIZATION_LOGOS_BUCKET_DEFAULT

/**
 * Extract storage object path from a Supabase public object URL (any bucket id after `/object/public/`).
 */
export function pathFromOrganizationLogoPublicUrl(url: string | null | undefined): string | null {
  const u = url?.trim()
  if (!u) return null
  const m = u.match(/\/object\/public\/[^/]+\/(.+)/)
  if (!m?.[1]) return null
  return m[1].split("?")[0]?.trim() || null
}
