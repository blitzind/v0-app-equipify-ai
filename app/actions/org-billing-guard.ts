"use server"

import { requireCanCreateRecord } from "@/lib/billing/server-guard"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * Server-side invite guard: billing + seat limits + membership.
 * Caller must still verify the user is an owner/admin in the org.
 */
export async function checkOrgInviteEligibility(
  organizationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "Sign in to invite team members." }
  }

  const gate = await requireCanCreateRecord(supabase, user.id, organizationId, "team_invite")
  if (!gate.ok) {
    return { ok: false, message: gate.message }
  }

  return { ok: true }
}
