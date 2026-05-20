/** Canonical dev/demo workspace slugs — keep aligned with `ensure_dev_demo_workspace_orgs`. */
export const DEMO_WORKSPACE_SLUGS = new Set([
  "acme",
  "zephyr",
  "medology",
  "precision-biomedical-demo",
])

export function isDemoWorkspaceSlug(slug: string | null | undefined): boolean {
  const normalized = slug?.trim().toLowerCase() ?? ""
  return normalized.length > 0 && DEMO_WORKSPACE_SLUGS.has(normalized)
}
