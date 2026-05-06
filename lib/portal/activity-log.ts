import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function logPortalActivity(
  svc: SupabaseClient,
  input: {
    organizationId: string
    portalUserId: string | null
    action: string
    path?: string | null
    resourceType?: string | null
    resourceId?: string | null
    metadata?: Record<string, unknown>
    ip?: string | null
    userAgent?: string | null
  },
): Promise<void> {
  try {
    await svc.from("portal_activity_logs").insert({
      organization_id: input.organizationId,
      portal_user_id: input.portalUserId,
      action: input.action,
      path: input.path ?? null,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      ip_inet: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    })
  } catch {
    // Avoid failing primary requests on audit insert issues.
  }
}
