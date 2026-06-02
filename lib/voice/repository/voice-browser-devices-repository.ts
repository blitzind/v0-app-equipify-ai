import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceBrowserDevicePublicView,
  VoiceBrowserDeviceStatus,
} from "@/lib/voice/browser-calling/types"

const VOICE_BROWSER_DEVICE_SELECT =
  "id, client_identity, provider, status, last_registered_at, last_heartbeat_at, active_voice_call_id"

function browserDevicesTable(admin: SupabaseClient) {
  return admin.schema("voice").from("voice_browser_devices")
}

function mapDeviceRow(row: Record<string, unknown>): VoiceBrowserDevicePublicView {
  return {
    id: row.id as string,
    clientIdentity: row.client_identity as string,
    provider: row.provider as VoiceBrowserDevicePublicView["provider"],
    status: row.status as VoiceBrowserDeviceStatus,
    lastRegisteredAt: row.last_registered_at as string,
    lastHeartbeatAt: row.last_heartbeat_at as string,
    activeVoiceCallId: (row.active_voice_call_id as string | null) ?? null,
  }
}

/** Read-only online browser device lookup for inbound routing — no sync/offer reconciliation. */
export async function listOnlineVoiceBrowserDevices(
  admin: SupabaseClient,
  organizationId: string,
  input?: { userIds?: string[] },
): Promise<VoiceBrowserDevicePublicView[]> {
  let query = browserDevicesTable(admin)
    .select(VOICE_BROWSER_DEVICE_SELECT)
    .eq("organization_id", organizationId)
    .in("status", ["available", "busy", "reconnecting"])
    .order("last_heartbeat_at", { ascending: false })
  if (input?.userIds?.length) {
    query = query.in("user_id", input.userIds)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDeviceRow(row as Record<string, unknown>))
}
