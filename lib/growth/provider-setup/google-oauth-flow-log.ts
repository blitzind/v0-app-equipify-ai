import "server-only"

import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"

export const GROWTH_GOOGLE_OAUTH_FLOW_QA_MARKER = "growth-google-oauth-flow-7c-v1"

export type GrowthGoogleOAuthFlowStage =
  | "oauth_start"
  | "oauth_callback_received"
  | "token_exchange_success"
  | "mailbox_resolved"
  | "mailbox_persisted"
  | "mailbox_validated"
  | "sender_linked"
  | "mailbox_sync_started"
  | "status_recomputed"
  | "redirect_generated"
  | "oauth_callback_failed"

export function logGrowthGoogleOAuthFlow(
  stage: GrowthGoogleOAuthFlowStage,
  details: {
    organizationId?: string | null
    senderId?: string | null
    mailboxId?: string | null
    userId?: string | null
    email?: string | null
    provider?: string | null
    connectionState?: string | null
    returnTo?: string | null
    validationStatus?: string | null
    validationReason?: string | null
    settingsStatus?: string | null
    resolvedMailboxId?: string | null
    resolvedSenderId?: string | null
    error?: string | null
  },
): void {
  logGrowthEngine(`growth_google_oauth_${stage}`, {
    qa_marker: GROWTH_GOOGLE_OAUTH_FLOW_QA_MARKER,
    organization_id: details.organizationId ?? getGrowthEngineAiOrgId(),
    sender_id: details.senderId ?? null,
    mailbox_id: details.mailboxId ?? null,
    user_id: details.userId ?? null,
    email: details.email ?? null,
    provider: details.provider ?? "google",
    connection_state: details.connectionState ?? null,
    return_to: details.returnTo ?? null,
    validation_status: details.validationStatus ?? null,
    validation_reason: details.validationReason ?? null,
    settings_status: details.settingsStatus ?? null,
    resolved_mailbox_id: details.resolvedMailboxId ?? null,
    resolved_sender_id: details.resolvedSenderId ?? null,
    error: details.error ?? null,
  })
}
