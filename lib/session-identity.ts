/** Signed-in user snapshot for headers / admin UI (not tenant mock data). */
export type SessionIdentity = {
  email: string
  displayName: string
  platformAdmin: boolean
  /** When platform admin; otherwise null. */
  platformRoleLabel: string | null
}
