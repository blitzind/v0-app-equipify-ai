import "server-only"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"
import type { SmsComplianceStatus, SmsProviderKind, WorkspaceSmsWorkspaceDto } from "@/lib/sms/workspace-sms-types"
import { DEFAULT_WORKSPACE_SMS_DTO } from "@/lib/sms/workspace-sms-types"

export type SmsWorkspaceSettingsRow = {
  organization_id: string
  sms_master_enabled: boolean
  opt_in_required: boolean
  provider_kind: string
  provider_configured: boolean
  compliance_status: string
  transactional_only: boolean
  sender_display_hint: string | null
}

export function looksLikeMissingSmsWorkspaceTablesError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const m = String(err.message ?? "").toLowerCase()
  const code = String(err.code ?? "")
  if (code === "42P01" || code === "PGRST205" || code === "42703") return true
  if (m.includes("organization_sms_workspace_settings") && (m.includes("does not exist") || m.includes("could not find"))) {
    return true
  }
  return false
}

function asProviderKind(raw: string): SmsProviderKind {
  if (raw === "twilio" || raw === "telnyx") return raw
  return "none"
}

function asCompliance(raw: string): SmsComplianceStatus {
  if (raw === "pending_review" || raw === "approved" || raw === "rejected") return raw
  return "not_started"
}

export function workspaceSmsRowToDto(row: SmsWorkspaceSettingsRow | null): WorkspaceSmsWorkspaceDto {
  if (!row) return { ...DEFAULT_WORKSPACE_SMS_DTO }
  const providerKind = asProviderKind(row.provider_kind)
  const complianceStatus = asCompliance(row.compliance_status)
  const smsChannelConfigurable =
    Boolean(row.sms_master_enabled) &&
    Boolean(row.provider_configured) &&
    complianceStatus === "approved"
  return {
    smsMasterEnabled: Boolean(row.sms_master_enabled),
    optInRequired: Boolean(row.opt_in_required),
    providerKind,
    providerConfigured: Boolean(row.provider_configured),
    complianceStatus,
    transactionalOnly: Boolean(row.transactional_only),
    senderDisplayHint: row.sender_display_hint,
    smsChannelConfigurable,
  }
}

export async function fetchWorkspaceSmsSettingsRow(
  client: SupabaseClient,
  organizationId: string,
): Promise<{ row: SmsWorkspaceSettingsRow | null; error: PostgrestError | null; persistenceReady: boolean }> {
  const res = await client
    .from("organization_sms_workspace_settings")
    .select(
      "organization_id, sms_master_enabled, opt_in_required, provider_kind, provider_configured, compliance_status, transactional_only, sender_display_hint",
    )
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (res.error) {
    if (looksLikeMissingSmsWorkspaceTablesError(res.error)) {
      return { row: null, error: null, persistenceReady: false }
    }
    return { row: null, error: res.error, persistenceReady: false }
  }
  return { row: (res.data as SmsWorkspaceSettingsRow | null) ?? null, error: null, persistenceReady: true }
}

export type UpsertWorkspaceSmsSettingsInput = {
  smsMasterEnabled: boolean
  optInRequired: boolean
  providerKind: SmsProviderKind
  providerConfigured: boolean
  complianceStatus: SmsComplianceStatus
  transactionalOnly: boolean
  senderDisplayHint: string | null
}

export async function upsertWorkspaceSmsSettings(
  svc: SupabaseClient,
  organizationId: string,
  input: UpsertWorkspaceSmsSettingsInput,
): Promise<{ error: PostgrestError | null }> {
  const { error } = await svc.from("organization_sms_workspace_settings").upsert(
    {
      organization_id: organizationId,
      sms_master_enabled: input.smsMasterEnabled,
      opt_in_required: input.optInRequired,
      provider_kind: input.providerKind,
      provider_configured: input.providerConfigured,
      compliance_status: input.complianceStatus,
      transactional_only: input.transactionalOnly,
      sender_display_hint: input.sender_display_hint,
    },
    { onConflict: "organization_id" },
  )
  return { error }
}
