/** Phase 7.PS-HZ — Corroborated contact channel completion types. Client-safe. */

import type { ProfessionalIdentityCorroborationSignal } from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-types"

export const GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_QA_MARKER =
  "growth-corroborated-contact-channel-completion-7-ps-hz-v1" as const

export const GROWTH_CORROBORATED_CONTACT_CHANNEL_COMPLETION_RUNTIME_QA_MARKER =
  "growth-corroborated-contact-channel-completion-runtime-7-ps-hz-v1" as const

export type CorroboratedChannelRuntimeProvenance = {
  local_env_used: boolean
  deployed_runtime_used: boolean
  provider_config_source: "local_cert_env" | "deployed_runtime" | "unavailable"
  cron_telemetry_run_id: string | null
  deployed_base_url: string | null
  execution_channel: "local" | "deployed_http" | "deployed_vercel_cron" | "skipped"
}

export type CorroboratedChannelRuntimeContext = {
  local_zerobounce_configured: boolean
  deployed_runtime_available: boolean
  deployed_zerobounce_configured: boolean
  deployed_production_safe: boolean
  deployed_base_url: string | null
  cron_secret_available: boolean
  email_execution_path: "local" | "deployed_runtime" | "unavailable"
}

export type CorroboratedPersonTarget = {
  person_id: string
  company_id: string
  company_name: string
  company_contact_id: string
  full_name: string
  corroboration_signals: ProfessionalIdentityCorroborationSignal[]
  corroboration_signal_count: number
}

export type CorroboratedContactChannelCompletionMetrics = {
  corroborated_persons_processed: number
  emails_discovered: number
  emails_verified: number
  emails_promoted: number
  phones_discovered: number
  phones_verified: number
  phones_promoted: number
  social_profiles_discovered: number
  social_profiles_verified: number
  social_profiles_promoted: number
  verified_channels_promoted: number
  persons_with_new_verified_channel: number
}

export type CorroboratedPersonChannelResult = {
  person_id: string
  full_name: string
  company_name: string
  company_id: string
  email: {
    attempted: boolean
    candidate_count: number
    verified_count: number
    promoted_count: number
    error: string | null
    runtime: CorroboratedChannelRuntimeProvenance
  }
  phone: {
    attempted: boolean
    candidate_count: number
    verified_count: number
    promoted_count: number
    error: string | null
  }
  social: {
    attempted: boolean
    candidate_count: number
    verified_count: number
    promoted_count: number
    error: string | null
  }
  verified_channels_before: number
  verified_channels_after: number
  gained_verified_channel: boolean
  messages: string[]
}
