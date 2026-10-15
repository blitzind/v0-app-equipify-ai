import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import { classifySmsOptOutKeyword, isSmsStopKeyword } from "@/lib/sms/sms-opt-out-rules"

export { classifySmsOptOutKeyword, evaluateGrowthSmsLiveSendGate, isSmsStopKeyword } from "@/lib/sms/sms-opt-out-rules"

export async function isOrganizationSmsSuppressed(
  admin: SupabaseClient,
  organizationId: string,
  e164: string,
): Promise<boolean> {
  const normalized = normalizeToE164(e164)
  if (!normalized) return false
  const { data, error } = await admin
    .from("organization_sms_suppressions")
    .select("e164")
    .eq("organization_id", organizationId)
    .eq("e164", normalized)
    .maybeSingle()
  if (error) {
    // Fail closed on live-send callers: treat lookup failure as suppressed.
    return true
  }
  return Boolean(data)
}

export async function recordOrganizationSmsSuppression(
  admin: SupabaseClient,
  input: { organizationId: string; e164: string; reason: "stop" | "help" | "admin" | "bounce" | "complaint" },
): Promise<{ ok: boolean }> {
  const normalized = normalizeToE164(input.e164)
  if (!normalized) return { ok: false }
  const { error } = await admin.from("organization_sms_suppressions").upsert(
    {
      organization_id: input.organizationId,
      e164: normalized,
      reason: input.reason,
    },
    { onConflict: "organization_id,e164" },
  )
  return { ok: !error }
}
