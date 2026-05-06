/**
 * Portal env (readable from middleware and route handlers). Keep minimal — no server-only imports.
 */
export function getPortalSessionSecret(): string | null {
  const s = process.env.PORTAL_SESSION_SECRET?.trim()
  if (!s || s.length < 32) return null
  return s
}
