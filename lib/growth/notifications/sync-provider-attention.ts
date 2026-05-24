import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitGrowthProviderAttentionNotification } from "@/lib/growth/notifications/notification-integrations"

type ProviderRow = {
  id: string
  provider_family: string
  display_name: string | null
  temporarily_degraded: boolean | null
  circuit_open: boolean | null
  is_active: boolean | null
}

export async function syncGrowthProviderAttentionNotifications(admin: SupabaseClient): Promise<number> {
  const { data: realtimeConnections, error: realtimeError } = await admin
    .schema("growth")
    .from("realtime_provider_connections")
    .select("id, provider_family, display_name, temporarily_degraded, circuit_open, is_active")

  if (realtimeError) throw new Error(realtimeError.message)

  let emitted = 0
  for (const row of (realtimeConnections ?? []) as ProviderRow[]) {
    const label = row.display_name ?? row.provider_family
    if (row.circuit_open) {
      await emitGrowthProviderAttentionNotification(admin, {
        connectionId: row.id,
        providerLabel: label,
        notificationType: "provider_circuit_open",
      })
      emitted += 1
      continue
    }
    if (row.is_active === false) {
      await emitGrowthProviderAttentionNotification(admin, {
        connectionId: row.id,
        providerLabel: label,
        notificationType: "provider_disconnected",
      })
      emitted += 1
      continue
    }
    if (row.temporarily_degraded) {
      await emitGrowthProviderAttentionNotification(admin, {
        connectionId: row.id,
        providerLabel: label,
        notificationType: "provider_degraded",
      })
      emitted += 1
    }
  }

  const { data: emailConnections, error: emailError } = await admin
    .schema("growth")
    .from("email_provider_connections")
    .select("id, provider_family, display_name, temporarily_degraded, is_active")

  if (emailError) throw new Error(emailError.message)

  for (const row of (emailConnections ?? []) as ProviderRow[]) {
    const label = row.display_name ?? row.provider_family
    if (row.is_active === false) {
      await emitGrowthProviderAttentionNotification(admin, {
        connectionId: row.id,
        providerLabel: label,
        notificationType: "provider_disconnected",
      })
      emitted += 1
      continue
    }
    if (row.temporarily_degraded) {
      await emitGrowthProviderAttentionNotification(admin, {
        connectionId: row.id,
        providerLabel: label,
        notificationType: "provider_degraded",
      })
      emitted += 1
    }
  }

  return emitted
}
