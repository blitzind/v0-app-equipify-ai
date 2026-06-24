/** Growth Engine — sender profiles & email signatures (GS-GROWTH-SIGNATURES-1A). Client-safe. */

export const GROWTH_SENDER_PROFILES_QA_MARKER = "growth-sender-profiles-1a-v1" as const

export const GROWTH_SIGNATURE_TEMPLATES = ["simple", "branded", "minimal", "professional"] as const
export type GrowthSignatureTemplateId = (typeof GROWTH_SIGNATURE_TEMPLATES)[number]

export type GrowthSenderProfile = {
  id: string
  sender_account_id: string
  mailbox_connection_id: string | null
  display_name: string
  title: string | null
  email: string
  phone: string | null
  company_name: string | null
  company_tagline: string | null
  website: string | null
  linkedin_url: string | null
  avatar_url: string | null
  logo_url: string | null
  booking_url: string | null
  booking_label: string | null
  show_email_in_signature: boolean
  show_phone_in_signature: boolean
  show_website_in_signature: boolean
  show_booking_cta: boolean
  active: boolean
  signature_template: GrowthSignatureTemplateId
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  /** Joined for dashboard display */
  sender_email?: string | null
  mailbox_email?: string | null
}

export type GrowthRenderedSignature = {
  template: GrowthSignatureTemplateId
  html: string
  text: string
}

export type GrowthSenderProfileDashboardRow = {
  profile: GrowthSenderProfile
  senderEmail: string
  mailboxEmail: string | null
  mailboxId: string | null
  senderStatus: string
  connectionStatus: string | null
  signatureStatus: GrowthSenderProfileSignatureStatus
}

export type GrowthSenderProfilesDashboardPayload = {
  qa_marker: typeof GROWTH_SENDER_PROFILES_QA_MARKER
  profiles: GrowthSenderProfileDashboardRow[]
  unassignedSenders: Array<{
    senderId: string
    email: string
    displayName: string
    mailboxId: string | null
    mailboxEmail: string | null
    signatureStatus: GrowthSenderProfileSignatureStatus
  }>
  templates: Array<{ id: GrowthSignatureTemplateId; label: string; description: string }>
}

export const GROWTH_SIGNATURE_TEMPLATE_LABELS: Record<GrowthSignatureTemplateId, string> = {
  simple: "Simple",
  branded: "Branded",
  minimal: "Minimal",
  professional: "Professional",
}

export const GROWTH_SENDER_PROFILE_SIGNATURE_STATUSES = [
  "configured",
  "missing",
  "inherited",
  "disabled",
] as const

export type GrowthSenderProfileSignatureStatus = (typeof GROWTH_SENDER_PROFILE_SIGNATURE_STATUSES)[number]

export const GROWTH_SENDER_PROFILE_SIGNATURE_STATUS_LABELS: Record<GrowthSenderProfileSignatureStatus, string> = {
  configured: "Configured",
  missing: "Missing",
  inherited: "Inherited",
  disabled: "Disabled",
}

export const GROWTH_SIGNATURE_PRIVACY_NOTE =
  "Sender profiles store display identity only. Signature HTML is rendered at send time — no third-party signature services."
