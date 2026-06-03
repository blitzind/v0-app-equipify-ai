"use client"

import { createBrowserSupabaseClient } from "@/lib/supabase/client"

export type VoiceBrowserFetchAuthSource = "bearer" | "cookie_only" | "none"

export type VoiceBrowserFetchAuthResult = {
  authSource: VoiceBrowserFetchAuthSource
  tokenRefreshed: boolean
  bearerAttached: boolean
  userId: string | null
  accessToken: string | null
}

export type VoiceBrowserClientAuthTelemetryEvent =
  | "voice_browser_fetch_auth_resolved"
  | "voice_browser_sync_auth_result"

export function logVoiceBrowserClientAuthTelemetry(
  event: VoiceBrowserClientAuthTelemetryEvent,
  details: Record<string, unknown>,
): void {
  if (typeof console === "undefined") return
  console.info(
    JSON.stringify({
      source: "voice-browser-client-auth",
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

export async function resolveVoiceBrowserFetchAuth(): Promise<VoiceBrowserFetchAuthResult> {
  const supabase = createBrowserSupabaseClient()
  const priorToken = (await supabase.auth.getSession()).data.session?.access_token ?? null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const nextToken = (await supabase.auth.getSession()).data.session?.access_token ?? null
  const tokenRefreshed = Boolean(priorToken && nextToken && priorToken !== nextToken)

  if (user && nextToken) {
    return {
      authSource: "bearer",
      tokenRefreshed,
      bearerAttached: true,
      userId: user.id,
      accessToken: nextToken,
    }
  }

  if (user) {
    return {
      authSource: "cookie_only",
      tokenRefreshed,
      bearerAttached: false,
      userId: user.id,
      accessToken: null,
    }
  }

  return {
    authSource: "none",
    tokenRefreshed: false,
    bearerAttached: false,
    userId: null,
    accessToken: null,
  }
}

export async function buildVoiceBrowserFetchInit(init?: RequestInit): Promise<RequestInit> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  let auth: VoiceBrowserFetchAuthResult = {
    authSource: "none",
    tokenRefreshed: false,
    bearerAttached: false,
    userId: null,
    accessToken: null,
  }

  try {
    auth = await resolveVoiceBrowserFetchAuth()
    if (auth.accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${auth.accessToken}`)
    }
  } catch {
    // Cookie auth may still succeed server-side after middleware refresh.
  }

  logVoiceBrowserClientAuthTelemetry("voice_browser_fetch_auth_resolved", {
    authSource: auth.authSource,
    tokenRefreshed: auth.tokenRefreshed,
    bearerAttached: auth.bearerAttached,
    userId: auth.userId,
  })

  return {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  }
}
