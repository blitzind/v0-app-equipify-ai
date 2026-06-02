import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  INBOUND_RING_DIAG_EVENTS,
  logInboundRingDiagnostic,
  withInboundRingElapsed,
} from "@/lib/voice/browser-calling/inbound-ring-diagnostics"
import { appendVoiceCallEvent } from "@/lib/voice/repository/voice-repository"

function sessionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("native_call_workspace_sessions")
}

export async function provisionInboundBrowserWorkspaceOffers(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    targetUserIds: string[]
    fromNumber: string
    toNumber: string
  },
): Promise<void> {
  if (!input.targetUserIds.length) return

  const now = new Date().toISOString()
  for (const userId of input.targetUserIds) {
    const { data: existing } = await sessionsTable(admin)
      .select("id")
      .eq("voice_call_id", input.voiceCallId)
      .eq("owner_user_id", userId)
      .maybeSingle()
    if (existing?.id) continue

    const { data: inserted, error: insertError } = await sessionsTable(admin)
      .insert({
        organization_id: input.organizationId,
        owner_user_id: userId,
        direction: "inbound",
        dial_mode: "inbound",
        status: "ringing",
        phone_number: input.fromNumber,
        contact_name: null,
        company_name: null,
        provider: "twilio",
        fallback_provider: null,
        voice_call_id: input.voiceCallId,
        recording_state: "pending",
        safe_summary: `Inbound browser offer from ${input.fromNumber} to ${input.toNumber}.`,
        started_at: now,
      })
      .select("id")
      .single()
    if (insertError) {
      logInboundRingDiagnostic(INBOUND_RING_DIAG_EVENTS.NATIVE_SESSION_CREATED, {
        voice_call_id: input.voiceCallId,
        owner_user_id: userId,
        organization_id: input.organizationId,
        provision_error: insertError.message,
      })
      continue
    }

    const { data: callRow } = await admin
      .schema("voice")
      .from("voice_calls")
      .select("started_at")
      .eq("id", input.voiceCallId)
      .maybeSingle()
    const voiceCallCreatedAt = (callRow?.started_at as string | null) ?? null

    logInboundRingDiagnostic(
      INBOUND_RING_DIAG_EVENTS.NATIVE_SESSION_CREATED,
      withInboundRingElapsed(voiceCallCreatedAt, {
        voice_call_id: input.voiceCallId,
        native_session_id: inserted.id as string,
        owner_user_id: userId,
        organization_id: input.organizationId,
      }),
    )
  }
}

export async function createInboundVoiceCallFromTwilio(
  admin: SupabaseClient,
  input: {
    organizationId: string
    providerCallId: string
    fromNumber: string
    toNumber: string
    assignedUserId?: string | null
    accountSid?: string | null
  },
): Promise<string> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: "twilio",
        provider_call_id: input.providerCallId,
        direction: "inbound",
        status: "ringing",
        from_number: input.fromNumber,
        to_number: input.toNumber,
        assigned_user_id: input.assignedUserId ?? null,
        started_at: now,
        metadata_json: {
          source: "inbound_twilio",
          browser_routing: true,
          ...(input.accountSid ? { account_sid: input.accountSid } : {}),
        },
      },
      { onConflict: "organization_id,provider,provider_call_id" },
    )
    .select("id")
    .single()
  if (error) throw new Error(error.message)

  const voiceCallId = data.id as string
  logInboundRingDiagnostic(INBOUND_RING_DIAG_EVENTS.VOICE_CALL_CREATED, {
    voice_call_id: voiceCallId,
    provider_call_id: input.providerCallId,
    voice_call_created_at: now,
    organization_id: input.organizationId,
    from_number: input.fromNumber,
    to_number: input.toNumber,
  })
  await appendVoiceCallEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId,
    provider: "twilio",
    eventType: "ringing",
    eventTimestamp: now,
    payloadJson: { source: "inbound_twilio" },
    idempotencyKey: `inbound:${input.providerCallId}:ringing`,
  })

  return voiceCallId
}
