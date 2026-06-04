import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLead } from "@/lib/growth/types"
import { buildPersonalizedSmsDraft } from "@/lib/growth/sms/personalization/assemble-sms-draft"
import { buildSmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-context-builder"
import type {
  SmsMessageType,
  SmsPersonalizationAudit,
  SmsPersonalizationDraft,
} from "@/lib/growth/sms/personalization/sms-personalization-types"

export async function runSmsPersonalizationForLead(
  admin: SupabaseClient,
  lead: GrowthLead,
  options?: {
    messageType?: SmsMessageType
    draftType?: "outbound" | "reply"
    maxChars?: number
  },
): Promise<{ audit: SmsPersonalizationAudit; draft: SmsPersonalizationDraft }> {
  const context = await buildSmsPersonalizationContext(admin, lead)
  return buildPersonalizedSmsDraft({
    leadId: lead.id,
    context,
    messageType: options?.messageType,
    draftType: options?.draftType,
    maxChars: options?.maxChars,
  })
}
