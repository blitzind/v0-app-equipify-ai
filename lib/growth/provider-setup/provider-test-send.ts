import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  executeTransportSend,
  TransportHumanApprovalRequiredError,
} from "@/lib/growth/providers/transport/transport-orchestrator"
import { recordProviderConnectionCheck, recordProviderSecretAuditEvent } from "@/lib/growth/provider-setup/provider-setup-events"
import type { GrowthProviderConnectionCheckResult, GrowthProviderSetupFamily } from "@/lib/growth/provider-setup/provider-setup-types"
import { getProviderConnectionSettings } from "@/lib/growth/provider-setup/dashboard"

export type ProviderTestSendInput = {
  providerFamily: GrowthProviderSetupFamily
  senderAccountId: string
  to: string
  subject: string
  text?: string
  html?: string
  humanApprovalConfirmed: boolean
  actorUserId: string
  actorEmail: string
}

export async function runProviderTestSend(
  admin: SupabaseClient,
  input: ProviderTestSendInput,
): Promise<GrowthProviderConnectionCheckResult> {
  if (!input.humanApprovalConfirmed) {
    return {
      check_type: "test_send",
      status: "failed",
      message: "humanApprovalConfirmed is required for test sends.",
    }
  }

  const settings = await getProviderConnectionSettings(admin, input.providerFamily)
  if (!settings) {
    return { check_type: "test_send", status: "failed", message: "Provider is not configured." }
  }

  if (process.env.GROWTH_TRANSPORT_SIMULATE?.trim() === "true") {
    const now = new Date().toISOString()
    await admin
      .schema("growth")
      .from("provider_connection_settings")
      .update({ last_test_send_at: now, status: "connected" })
      .eq("provider_family", input.providerFamily)

    await recordProviderConnectionCheck(admin, {
      providerFamily: input.providerFamily,
      checkType: "test_send",
      status: "passed",
      message: "Simulated test send passed (GROWTH_TRANSPORT_SIMULATE=true).",
      actorUserId: input.actorUserId,
      details: { to: input.to, simulated: true },
    })
    await recordProviderSecretAuditEvent(admin, {
      providerFamily: input.providerFamily,
      action: "test_send",
      actorUserId: input.actorUserId,
      metadata: { simulated: true, to_domain: input.to.split("@")[1] ?? "unknown" },
    })

    return {
      check_type: "test_send",
      status: "passed",
      message: "Simulated test send passed.",
      details: { simulated: true },
    }
  }

  try {
    const result = await executeTransportSend(admin, {
      sender_account_id: input.senderAccountId,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      human_approved: true,
      human_approval_confirmed: true,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      is_test: true,
      metadata: {
        provider_setup_test_send: true,
        provider_family: input.providerFamily,
      },
    })

    const status = result.ok ? "passed" : "failed"
    const message = result.ok
      ? "Test send queued/sent via transport orchestrator."
      : result.error ?? "Test send failed."

    if (result.ok) {
      await admin
        .schema("growth")
        .from("provider_connection_settings")
        .update({ last_test_send_at: new Date().toISOString(), status: "connected" })
        .eq("provider_family", input.providerFamily)

      const { recordInternalOutboundAuditEvent } = await import("@/lib/growth/operations/internal-outbound-audit")
      await recordInternalOutboundAuditEvent(admin, {
        eventType: "send_verification_recorded",
        severity: "low",
        title: "Provider test send verified",
        summary: `Test send via ${input.providerFamily} transport orchestrator succeeded.`,
        senderAccountId: input.senderAccountId,
        deliveryAttemptId: result.attempt?.id ?? null,
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
        metadata: { provider_family: input.providerFamily, is_test: true },
      }).catch(() => undefined)
    }

    await recordProviderConnectionCheck(admin, {
      providerFamily: input.providerFamily,
      checkType: "test_send",
      status,
      message,
      actorUserId: input.actorUserId,
      details: {
        attempt_id: result.attempt?.id ?? null,
        provider_message_id: result.provider_message_id ?? null,
      },
    })
    await recordProviderSecretAuditEvent(admin, {
      providerFamily: input.providerFamily,
      action: "test_send",
      actorUserId: input.actorUserId,
      metadata: { ok: result.ok, to_domain: input.to.split("@")[1] ?? "unknown" },
    })

    return { check_type: "test_send", status, message, details: { attempt_id: result.attempt?.id ?? null } }
  } catch (error) {
    if (error instanceof TransportHumanApprovalRequiredError) {
      return {
        check_type: "test_send",
        status: "failed",
        message: "Human approval confirmation required.",
      }
    }
    const message = error instanceof Error ? error.message : "test_send_failed"
    await recordProviderConnectionCheck(admin, {
      providerFamily: input.providerFamily,
      checkType: "test_send",
      status: "failed",
      message,
      actorUserId: input.actorUserId,
    })
    return { check_type: "test_send", status: "failed", message }
  }
}
