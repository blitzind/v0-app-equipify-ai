/** Resolve native workspace call direction for a realtime coaching session. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function resolveNativeCallDirectionForRealtimeSession(
  admin: SupabaseClient,
  realtimeSessionId: string,
): Promise<"inbound" | "outbound" | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("native_call_workspace_sessions")
    .select("direction")
    .eq("realtime_session_id", realtimeSessionId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const direction = (data?.direction as string | null) ?? null
  if (direction === "inbound" || direction === "outbound") return direction
  return null
}
