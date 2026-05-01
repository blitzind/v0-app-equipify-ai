import "server-only"

import type { Session, User } from "@supabase/supabase-js"

import { createServerSupabaseClient } from "@/lib/supabase-server"

type AuthResult<T> = {
  data: T | null
  error: string | null
}

export async function getCurrentSession(
  accessToken?: string,
): Promise<AuthResult<Session>> {
  const supabase = createServerSupabaseClient()

  if (accessToken) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken)

    if (error) {
      return { data: null, error: error.message }
    }

    if (!user) {
      return { data: null, error: null }
    }

    return {
      data: {
        access_token: accessToken,
        token_type: "bearer",
        user,
      } as Session,
      error: null,
    }
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  return {
    data: session,
    error: error?.message ?? null,
  }
}

export async function getCurrentUser(accessToken?: string): Promise<AuthResult<User>> {
  const supabase = createServerSupabaseClient()

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken)
    return {
      data: data.user,
      error: error?.message ?? null,
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return {
    data: user,
    error: error?.message ?? null,
  }
}
