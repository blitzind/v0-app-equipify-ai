import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { validateRealtimeProviderConnection } from "@/lib/growth/realtime/providers/realtime-provider-validation"

export async function probeRealtimeProviderHealth(
  admin: SupabaseClient,
  connectionId: string,
): Promise<{ healthStatus: string; latencyMs: number; message: string }> {
  const result = await validateRealtimeProviderConnection(admin, {
    connectionId,
    force: true,
  })
  return {
    healthStatus: result.validation.healthStatus,
    latencyMs: result.validation.latencyMs,
    message: result.validation.message,
  }
}
