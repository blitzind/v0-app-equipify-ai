/** GE-AUTO-1C/1E — Channel prepare + send configuration helpers (client-safe). */

import {
  GROWTH_AUTONOMY_DEFAULT_MIN_SEND_CONFIDENCE,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import type {
  GrowthAutonomyChannelKey,
  GrowthAutonomyChannelPrepareConfig,
  GrowthAutonomyOutboundControls,
  GrowthAutonomyPrepareCapability,
  GrowthAutonomyQuietHours,
} from "@/lib/growth/autonomy/growth-autonomy-types"

export const GROWTH_AUTONOMY_CHANNEL_PREPARE_QA_MARKER = "growth-autonomy-ge-auto-1f-v1" as const

export const GROWTH_AUTONOMY_CHANNEL_KEYS: readonly GrowthAutonomyChannelKey[] = [
  "email",
  "sms",
  "voice",
] as const

export const GROWTH_AUTONOMY_CHANNEL_LABELS: Record<GrowthAutonomyChannelKey, string> = {
  email: "Email",
  sms: "SMS",
  voice: "Voice drops",
}

export const GROWTH_AUTONOMY_PREPARE_CAPABILITY_TO_CHANNEL: Record<
  GrowthAutonomyPrepareCapability,
  GrowthAutonomyChannelKey
> = {
  email_prepare: "email",
  sms_prepare: "sms",
  voice_prepare: "voice",
}

export const GROWTH_AUTONOMY_CHANNEL_TO_PREPARE_CAPABILITY: Record<
  GrowthAutonomyChannelKey,
  GrowthAutonomyPrepareCapability
> = {
  email: "email_prepare",
  sms: "sms_prepare",
  voice: "voice_prepare",
}

export const GROWTH_AUTONOMY_CHANNEL_TO_EXECUTION_CAPABILITY: Record<
  GrowthAutonomyChannelKey,
  "email_execution" | "sms_execution" | "voice_execution"
> = {
  email: "email_execution",
  sms: "sms_execution",
  voice: "voice_execution",
}

export const GROWTH_AUTONOMY_CHANNEL_PREPARE_BUDGET_RESOURCE: Record<
  GrowthAutonomyChannelKey,
  `autonomous_${GrowthAutonomyChannelKey}_prepare`
> = {
  email: "autonomous_email_prepare",
  sms: "autonomous_sms_prepare",
  voice: "autonomous_voice_prepare",
}

export const GROWTH_AUTONOMY_CHANNEL_SEND_BUDGET_RESOURCE: Record<
  GrowthAutonomyChannelKey,
  `autonomous_${GrowthAutonomyChannelKey}_send`
> = {
  email: "autonomous_email_send",
  sms: "autonomous_sms_send",
  voice: "autonomous_voice_send",
}

export function buildDefaultGrowthAutonomyQuietHours(): GrowthAutonomyQuietHours {
  return {
    enabled: false,
    startHourUtc: 22,
    endHourUtc: 13,
  }
}

export function buildDefaultGrowthAutonomyChannelPrepareConfig(): GrowthAutonomyChannelPrepareConfig {
  return {
    enabled_for_prepare: false,
    max_prepared_per_day: 0,
    enabled_for_send: false,
    max_sends_per_day: 0,
    minimum_send_confidence: GROWTH_AUTONOMY_DEFAULT_MIN_SEND_CONFIDENCE,
    allowed_sender_profiles: [],
    allowed_sequences: [],
    allowed_audiences: [],
    minimum_confidence_score: 0,
    quiet_hours: buildDefaultGrowthAutonomyQuietHours(),
    approvalPolicy: "always_require_approval",
  }
}

export function buildDefaultGrowthAutonomyOutboundControls(): GrowthAutonomyOutboundControls {
  return {
    shadowModeEnabled: false,
  }
}

export function normalizeGrowthAutonomyOutboundControls(raw: unknown): GrowthAutonomyOutboundControls {
  const defaults = buildDefaultGrowthAutonomyOutboundControls()
  if (!raw || typeof raw !== "object") return defaults
  const input = raw as Record<string, unknown>
  return {
    shadowModeEnabled:
      typeof input.shadowModeEnabled === "boolean" ? input.shadowModeEnabled : defaults.shadowModeEnabled,
  }
}

export function buildDefaultGrowthAutonomyChannelPermissions(): Record<
  GrowthAutonomyChannelKey,
  GrowthAutonomyChannelPrepareConfig
> {
  return {
    email: buildDefaultGrowthAutonomyChannelPrepareConfig(),
    sms: buildDefaultGrowthAutonomyChannelPrepareConfig(),
    voice: buildDefaultGrowthAutonomyChannelPrepareConfig(),
  }
}

export function normalizeGrowthAutonomyChannelPrepareConfig(
  raw: unknown,
): GrowthAutonomyChannelPrepareConfig {
  const defaults = buildDefaultGrowthAutonomyChannelPrepareConfig()
  if (!raw || typeof raw !== "object") return defaults
  const input = raw as Record<string, unknown>

  const quietRaw = input.quiet_hours
  let quiet_hours = defaults.quiet_hours
  if (quietRaw && typeof quietRaw === "object") {
    const q = quietRaw as Record<string, unknown>
    quiet_hours = {
      enabled: typeof q.enabled === "boolean" ? q.enabled : defaults.quiet_hours.enabled,
      startHourUtc:
        typeof q.startHourUtc === "number" && q.startHourUtc >= 0 && q.startHourUtc <= 23
          ? Math.floor(q.startHourUtc)
          : defaults.quiet_hours.startHourUtc,
      endHourUtc:
        typeof q.endHourUtc === "number" && q.endHourUtc >= 0 && q.endHourUtc <= 23
          ? Math.floor(q.endHourUtc)
          : defaults.quiet_hours.endHourUtc,
    }
  }

  const legacyEnabled = typeof input.enabled === "boolean" ? input.enabled : false

  return {
    enabled_for_prepare:
      typeof input.enabled_for_prepare === "boolean"
        ? input.enabled_for_prepare
        : legacyEnabled,
    max_prepared_per_day:
      typeof input.max_prepared_per_day === "number" && input.max_prepared_per_day >= 0
        ? Math.floor(input.max_prepared_per_day)
        : 0,
    enabled_for_send:
      typeof input.enabled_for_send === "boolean" ? input.enabled_for_send : false,
    max_sends_per_day:
      typeof input.max_sends_per_day === "number" && input.max_sends_per_day >= 0
        ? Math.floor(input.max_sends_per_day)
        : 0,
    minimum_send_confidence:
      typeof input.minimum_send_confidence === "number" &&
      input.minimum_send_confidence >= 0 &&
      input.minimum_send_confidence <= 100
        ? Math.floor(input.minimum_send_confidence)
        : GROWTH_AUTONOMY_DEFAULT_MIN_SEND_CONFIDENCE,
    allowed_sender_profiles: Array.isArray(input.allowed_sender_profiles)
      ? input.allowed_sender_profiles.filter((v): v is string => typeof v === "string")
      : [],
    allowed_sequences: Array.isArray(input.allowed_sequences)
      ? input.allowed_sequences.filter((v): v is string => typeof v === "string")
      : [],
    allowed_audiences: Array.isArray(input.allowed_audiences)
      ? input.allowed_audiences.filter((v): v is string => typeof v === "string")
      : [],
    minimum_confidence_score:
      typeof input.minimum_confidence_score === "number" &&
      input.minimum_confidence_score >= 0 &&
      input.minimum_confidence_score <= 100
        ? Math.floor(input.minimum_confidence_score)
        : 0,
    quiet_hours,
    approvalPolicy: "always_require_approval",
  }
}

export function isWithinChannelQuietHours(
  quietHours: GrowthAutonomyQuietHours,
  now = new Date(),
): boolean {
  if (!quietHours.enabled) return false
  const hourUtc = now.getUTCHours()
  const { startHourUtc, endHourUtc } = quietHours
  if (startHourUtc === endHourUtc) return false
  if (startHourUtc < endHourUtc) {
    return hourUtc >= startHourUtc && hourUtc < endHourUtc
  }
  return hourUtc >= startHourUtc || hourUtc < endHourUtc
}

export function isSenderProfileAllowed(
  config: GrowthAutonomyChannelPrepareConfig,
  senderProfileId: string | null | undefined,
): boolean {
  if (config.allowed_sender_profiles.length === 0) return false
  if (!senderProfileId) return false
  return config.allowed_sender_profiles.includes(senderProfileId)
}

export function isSequenceAllowed(
  config: GrowthAutonomyChannelPrepareConfig,
  sequenceId: string | null | undefined,
): boolean {
  if (!sequenceId) return true
  if (config.allowed_sequences.length === 0) return false
  return config.allowed_sequences.includes(sequenceId)
}

export function isAudienceAllowed(
  config: GrowthAutonomyChannelPrepareConfig,
  audienceId: string | null | undefined,
): boolean {
  if (!audienceId) return true
  if (config.allowed_audiences.length === 0) return false
  return config.allowed_audiences.includes(audienceId)
}

export function isGrowthAutonomyPrepareCapability(
  value: string,
): value is GrowthAutonomyPrepareCapability {
  return value === "email_prepare" || value === "sms_prepare" || value === "voice_prepare"
}
