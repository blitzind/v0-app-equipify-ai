import "server-only"

/**
 * When **not** set to `1`, prepared-workspace tier packaging is **disabled** and `canPrepareAidenAction`
 * keeps the legacy `planGate` path only (permissive defaults on several actions).
 */
export function isAidenPreparedWorkspaceTierGatingEnabled(): boolean {
  return process.env.AIDEN_PREPARED_WORKSPACE_TIER_GATING === "1"
}
