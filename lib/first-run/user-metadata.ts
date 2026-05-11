/** Auth user_metadata keys for first-run / launchpad UX (client + server read-safe). */

export const FIRST_RUN_WELCOME_ACK_ORG_IDS = "equipify_welcome_ack_org_ids"
export const FIRST_RUN_LAUNCHPAD_HIDDEN_ORG_IDS = "equipify_launchpad_hidden_org_ids"

export function parseOrgIdList(meta: Record<string, unknown> | null | undefined, key: string): string[] {
  const raw = meta?.[key]
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0)
}

export function withOrgIdAppended(current: string[], orgId: string): string[] {
  if (current.includes(orgId)) return current
  return [...current, orgId]
}

export function withOrgIdRemoved(current: string[], orgId: string): string[] {
  return current.filter((id) => id !== orgId)
}
