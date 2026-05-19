import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isValidExpoPushToken,
  normalizePushDevicePlatform,
  type PushDevicePlatform,
} from "@/lib/push/push-device-validation"

export type RegisterUserPushDeviceInput = {
  userId: string
  organizationId: string
  expoPushToken: string
  platform?: string | null
}

export type RegisterUserPushDeviceResult =
  | { ok: true; deviceId: string }
  | { ok: false; code: "invalid_token" | "upsert_failed" }

export async function registerUserPushDevice(
  supabase: SupabaseClient,
  input: RegisterUserPushDeviceInput,
): Promise<RegisterUserPushDeviceResult> {
  const token = input.expoPushToken.trim()
  if (!isValidExpoPushToken(token)) {
    return { ok: false, code: "invalid_token" }
  }

  const platform: PushDevicePlatform = normalizePushDevicePlatform(input.platform)
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("user_push_devices")
    .upsert(
      {
        user_id: input.userId,
        organization_id: input.organizationId,
        expo_push_token: token,
        platform,
        last_seen: now,
      },
      { onConflict: "user_id,organization_id,expo_push_token" },
    )
    .select("id")
    .maybeSingle()

  if (error || !data?.id) {
    return { ok: false, code: "upsert_failed" }
  }

  return { ok: true, deviceId: data.id }
}

export async function unregisterUserPushDevice(
  supabase: SupabaseClient,
  input: { userId: string; organizationId: string; expoPushToken: string },
): Promise<void> {
  const token = input.expoPushToken.trim()
  if (!isValidExpoPushToken(token)) return

  await supabase
    .from("user_push_devices")
    .delete()
    .eq("user_id", input.userId)
    .eq("organization_id", input.organizationId)
    .eq("expo_push_token", token)
}

/** Sign-out: remove all device rows for this user in the workspace. */
export async function unregisterAllUserPushDevicesForOrg(
  supabase: SupabaseClient,
  input: { userId: string; organizationId: string },
): Promise<void> {
  await supabase
    .from("user_push_devices")
    .delete()
    .eq("user_id", input.userId)
    .eq("organization_id", input.organizationId)
}
