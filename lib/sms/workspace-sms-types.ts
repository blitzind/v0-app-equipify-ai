/** Public-safe workspace SMS policy fields (API / UI). No secrets. */
export type SmsComplianceStatus = "not_started" | "pending_review" | "approved" | "rejected"

export type SmsProviderKind = "none" | "twilio" | "telnyx"

export type WorkspaceSmsWorkspaceDto = {
  smsMasterEnabled: boolean
  optInRequired: boolean
  providerKind: SmsProviderKind
  /** Workspace acknowledges provider credentials are configured in hosting (never exposes secrets). */
  providerConfigured: boolean
  complianceStatus: SmsComplianceStatus
  transactionalOnly: boolean
  senderDisplayHint: string | null
  /** When true, per-alert SMS toggles may be enabled and persisted; sending still requires full pipeline gates. */
  smsChannelConfigurable: boolean
}

export const DEFAULT_WORKSPACE_SMS_DTO: WorkspaceSmsWorkspaceDto = {
  smsMasterEnabled: false,
  optInRequired: true,
  providerKind: "none",
  providerConfigured: false,
  complianceStatus: "not_started",
  transactionalOnly: true,
  senderDisplayHint: null,
  smsChannelConfigurable: false,
}
