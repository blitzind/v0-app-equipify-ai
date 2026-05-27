import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthProviderSetupFamily } from "@/lib/growth/provider-setup/provider-setup-types"

export async function recordProviderSecretAuditEvent(
  admin: SupabaseClient,
  input: {
    providerFamily: GrowthProviderSetupFamily
    action:
      | "credentials_updated"
      | "oauth_connected"
      | "oauth_reconnect_started"
      | "disabled"
      | "reconnect"
      | "webhook_secret_updated"
      | "test_connection"
      | "test_send"
    actorUserId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await admin.schema("growth").from("provider_secret_audit_events").insert({
    provider_family: input.providerFamily,
    action: input.action,
    actor_user_id: input.actorUserId ?? null,
    metadata: input.metadata ?? {},
  })
}

export async function recordProviderConnectionCheck(
  admin: SupabaseClient,
  input: {
    providerFamily: GrowthProviderSetupFamily
    checkType: "test_connection" | "test_send" | "token_refresh" | "readiness"
    status: "passed" | "failed" | "warning" | "skipped"
    message: string
    actorUserId?: string | null
    details?: Record<string, unknown>
  },
): Promise<void> {
  await admin.schema("growth").from("provider_connection_checks").insert({
    provider_family: input.providerFamily,
    check_type: input.checkType,
    status: input.status,
    message: input.message,
    actor_user_id: input.actorUserId ?? null,
    details: input.details ?? {},
  })
}
