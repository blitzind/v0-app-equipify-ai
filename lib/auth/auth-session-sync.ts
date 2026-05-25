"use client"

import { createBrowserSupabaseClient } from "@/lib/supabase/client"

export type AuthSessionEvent =
  | { type: "signed_out" }
  | { type: "signed_in"; userId: string }
  | { type: "user_updated"; userId: string }
  | { type: "token_refreshed"; userId: string }

type AuthSessionListener = (event: AuthSessionEvent) => void

let subscriptionStarted = false
const listeners = new Set<AuthSessionListener>()

function emit(event: AuthSessionEvent) {
  for (const listener of listeners) {
    listener(event)
  }
}

function ensureAuthSubscription() {
  if (subscriptionStarted || typeof window === "undefined") return
  subscriptionStarted = true

  const supabase = createBrowserSupabaseClient()
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id ?? null

    if (event === "SIGNED_OUT" || !userId) {
      emit({ type: "signed_out" })
      return
    }

    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      emit({ type: "signed_in", userId })
      return
    }

    if (event === "USER_UPDATED") {
      emit({ type: "user_updated", userId })
      return
    }

    if (event === "TOKEN_REFRESHED") {
      emit({ type: "token_refreshed", userId })
    }
  })

  if (!data?.subscription) {
    subscriptionStarted = false
  }
}

/** Singleton Supabase auth listener — safe to call from multiple providers. */
export function subscribeToAuthSessionChanges(listener: AuthSessionListener): () => void {
  listeners.add(listener)
  ensureAuthSubscription()
  return () => {
    listeners.delete(listener)
  }
}
