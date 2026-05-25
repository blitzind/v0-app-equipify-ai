/** Signed-in user snapshot for headers / admin UI (not tenant mock data). */
export type SessionIdentity = {
  /** Supabase auth.users.id — must match the current session user. */
  authUserId: string
  email: string
  displayName: string
  platformAdmin: boolean
  /** When platform admin; otherwise null. */
  platformRoleLabel: string | null
}
