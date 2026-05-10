/**
 * Portal UI tokens — maps workspace `organizations.primary_color` into the same
 * `--portal-accent*` CSS variables the live customer portal uses (`app/globals.css`).
 * Used by staff preview, authenticated `PortalShell` (bootstrap), and optional login `?organizationId=`.
 */

const DEFAULT_PORTAL_ACCENT = "#2563eb"

const HEX_6 = /^#[0-9a-fA-F]{6}$/
const HEX_3 = /^#[0-9a-fA-F]{3}$/

/** Normalize workspace primary color to `#rrggbb` or fall back to default blue. */
export function resolvePortalPrimaryAccentHex(input: string | null | undefined): string {
  const t = input?.trim() ?? ""
  if (!t) return DEFAULT_PORTAL_ACCENT
  if (HEX_6.test(t)) return t.toLowerCase()
  if (HEX_3.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return DEFAULT_PORTAL_ACCENT
}

/**
 * Inline style fragment for `style={{ ...portalAccentCssVariables(hex), ... }}`.
 * Keeps preview/login aligned with the authenticated portal shell (links, nav active, icons).
 */
export function portalAccentCssVariables(accentHex: string): Record<string, string> {
  const a = resolvePortalPrimaryAccentHex(accentHex)
  return {
    "--portal-accent": a,
    "--portal-accent-dark": `color-mix(in srgb, ${a} 78%, #000000)`,
    "--portal-accent-muted": `color-mix(in srgb, ${a} 12%, #ffffff)`,
    /* Readable link / active-nav text on light surfaces for arbitrary brand hues */
    "--portal-accent-text": `color-mix(in srgb, ${a} 52%, #0f172a)`,
  }
}

/**
 * Inline styles for the active portal nav item (header links).
 * Tailwind arbitrary classes like `text-[--portal-accent]` do not reliably emit
 * `var(--portal-accent)`; using tokens here keeps branding colors correct.
 */
export const PORTAL_HEADER_NAV_ACTIVE_STYLE: Record<string, string> = {
  color: "var(--portal-accent-text)",
  background: "var(--portal-accent-muted)",
  fontWeight: "600",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--portal-accent) 26%, transparent)",
}
