/** Apollo pilot cohort materialization validation — production-safe acting user resolution. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthRepRoster } from "@/lib/growth/assignment/rep-roster-repository"
import { normalizeGrowthActorUserIdForDb } from "@/lib/growth/actor-user-id"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"

export const APOLLO_PILOT_MATERIALIZATION_VALIDATION_ACTOR_EMAIL =
  "apollo-pilot-materialize-validation@equipify.internal" as const

export type ApolloPilotMaterializationValidationActorSource =
  | "platform_admin"
  | "env_override"
  | "growth_rep_roster"
  | "profiles"
  | "auth_users"

export type ApolloPilotMaterializationValidationActor = {
  acting_user_id: string
  acting_user_email: string
  actor_source: ApolloPilotMaterializationValidationActorSource
}

async function resolveAuthUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalized)
  return match?.id ?? null
}

async function resolvePlatformAdminActingUser(admin: SupabaseClient): Promise<{
  userId: string
  email: string
  source: ApolloPilotMaterializationValidationActorSource
}> {
  const emails = getPlatformAdminEmails()
  if (emails.length > 0) {
    const email = emails[0]!
    const reps = await listGrowthRepRoster(admin)
    const rep = reps.find((entry) => entry.email.trim().toLowerCase() === email)
    if (rep) {
      return { userId: rep.userId, email: rep.email, source: "platform_admin" }
    }

    const userId = await resolveAuthUserIdByEmail(admin, email)
    if (userId) return { userId, email, source: "platform_admin" }
  }

  const reps = await listGrowthRepRoster(admin)
  const rosterRep = reps.find((entry) => normalizeGrowthActorUserIdForDb(entry.userId))
  if (rosterRep) {
    return {
      userId: rosterRep.userId,
      email: rosterRep.email,
      source: "growth_rep_roster",
    }
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", "%@equipify.%")
    .limit(1)
    .maybeSingle()
  if (profileError) throw new Error(profileError.message)
  if (profile?.id) {
    return {
      userId: profile.id,
      email: profile.email ?? APOLLO_PILOT_MATERIALIZATION_VALIDATION_ACTOR_EMAIL,
      source: "profiles",
    }
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
  if (error) throw new Error(error.message)
  const authUser = data.users.find((user) => user.id && user.email?.trim())
  if (authUser?.id) {
    return {
      userId: authUser.id,
      email: authUser.email ?? APOLLO_PILOT_MATERIALIZATION_VALIDATION_ACTOR_EMAIL,
      source: "auth_users",
    }
  }

  throw new Error(
    "Could not resolve a production auth user for Apollo pilot materialization validation — configure EQUIPIFY_PLATFORM_ADMIN_EMAILS or GROWTH_APOLLO_PILOT_MATERIALIZE_ACTING_USER_ID.",
  )
}

/**
 * Resolve a real production auth user for validation/materialization scripts.
 * Mirrors reply-flow harness platform-admin lookup with production DB fallbacks.
 */
export async function resolveApolloPilotMaterializationValidationActor(
  admin: SupabaseClient,
  input?: {
    acting_user_id?: string | null
    acting_user_email?: string | null
  },
): Promise<ApolloPilotMaterializationValidationActor> {
  const envOverrideId = normalizeGrowthActorUserIdForDb(input?.acting_user_id)
  const envOverrideEmail = input?.acting_user_email?.trim()
  if (envOverrideId && envOverrideEmail) {
    return {
      acting_user_id: envOverrideId,
      acting_user_email: envOverrideEmail,
      actor_source: "env_override",
    }
  }

  const acting = await resolvePlatformAdminActingUser(admin)
  return {
    acting_user_id: acting.userId,
    acting_user_email: acting.email,
    actor_source: acting.source,
  }
}
