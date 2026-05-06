export const ORGANIZATION_LOGOS_BUCKET = "organization-logos"

/** Extract storage object path from public URL for `organization-logos` bucket. */
export function pathFromOrganizationLogoPublicUrl(url: string | null | undefined): string | null {
  const u = url?.trim()
  if (!u) return null
  const marker = `/object/public/${ORGANIZATION_LOGOS_BUCKET}/`
  const i = u.indexOf(marker)
  if (i === -1) return null
  const path = u.slice(i + marker.length).split("?")[0]?.trim()
  return path || null
}
