/**
 * Maps Supabase `organizations.slug` to mock tenant / workspace bundle ids used by
 * `getWorkspaceData` and the tenant UI (quotes, invoices, client-side stores).
 * Unknown slugs use `ws-live-generic` (empty bundle — no cross-tenant demo bleed).
 */
export const ORG_SLUG_TO_WORKSPACE_TEMPLATE_ID: Record<string, string> = {
  acme: "ws-acme",
  medology: "ws-medology",
  zephyr: "ws-zephyr",
  "precision-biomedical-demo": "ws-precision-biomedical",
}

export function workspaceTemplateIdForOrgSlug(slug: string | null | undefined): string {
  if (!slug || !String(slug).trim()) return "ws-live-generic"
  const key = String(slug).trim().toLowerCase()
  return ORG_SLUG_TO_WORKSPACE_TEMPLATE_ID[key] ?? "ws-live-generic"
}
