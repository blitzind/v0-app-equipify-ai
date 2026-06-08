import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import type { GrowthSequenceTouch } from "@/lib/growth/sequence-types"
import { evaluateCommunicationComplianceForPhone } from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { recentDeliveryForPhone } from "@/lib/voice/repository/voice-drop-repository"
import { VOICE_DROP_FREQUENCY_CAP_DAYS } from "@/lib/voice/voice-drops/types"

export const SEQUENCE_VOICE_DROP_FATIGUE_DEFAULTS = {
  minHoursAfterSms: 24,
  minHoursAfterCall: 12,
} as const

export type SequenceVoiceDropFatigueCode =
  | "missing_recipient_phone"
  | "voice_drop_cooldown_active"
  | "voice_opt_out"
  | "outside_call_hours"
  | "compliance_blocked"
  | "sms_fatigue_window"
  | "call_fatigue_window"

function hoursSince(iso: string, nowMs: number): number {
  return (nowMs - Date.parse(iso)) / (60 * 60 * 1000)
}

function lastTouchByChannels(touches: GrowthSequenceTouch[], channels: string[]): GrowthSequenceTouch | null {
  const filtered = touches.filter((touch) => channels.includes(touch.channel))
  return filtered.length > 0 ? filtered[filtered.length - 1]! : null
}

export async function evaluateSequenceVoiceDropFatigueGate(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string | null | undefined
    touches?: GrowthSequenceTouch[]
    nowMs?: number
  },
): Promise<{ allowed: true } | { allowed: false; code: SequenceVoiceDropFatigueCode; message: string }> {
  const nowMs = input.nowMs ?? Date.now()
  const toE164 = normalizeToE164(input.phoneNumber)
  if (!toE164) {
    return { allowed: false, code: "missing_recipient_phone", message: "Lead phone required for voice drop fatigue checks." }
  }

  const capSince = new Date(nowMs)
  capSince.setDate(capSince.getDate() - VOICE_DROP_FREQUENCY_CAP_DAYS)
  const recentDelivery = await recentDeliveryForPhone(
    admin,
    input.organizationId,
    toE164,
    capSince.toISOString(),
  )
  if (recentDelivery) {
    return {
      allowed: false,
      code: "voice_drop_cooldown_active",
      message: `Voice drop cooldown active (${VOICE_DROP_FREQUENCY_CAP_DAYS} days).`,
    }
  }

  const touches = input.touches ?? []
  const lastVoiceDropTouch = lastTouchByChannels(touches, ["voice_drop"])
  if (lastVoiceDropTouch && hoursSince(lastVoiceDropTouch.occurredAt, nowMs) < VOICE_DROP_FREQUENCY_CAP_DAYS * 24) {
    return {
      allowed: false,
      code: "voice_drop_cooldown_active",
      message: "Recent voice drop touch recorded — cooldown window active.",
    }
  }

  const lastSms = lastTouchByChannels(touches, ["sms"])
  if (lastSms && hoursSince(lastSms.occurredAt, nowMs) < SEQUENCE_VOICE_DROP_FATIGUE_DEFAULTS.minHoursAfterSms) {
    return {
      allowed: false,
      code: "sms_fatigue_window",
      message: `SMS sent within ${SEQUENCE_VOICE_DROP_FATIGUE_DEFAULTS.minHoursAfterSms}h — defer voice drop.`,
    }
  }

  const lastCall = lastTouchByChannels(touches, ["manual_call", "call"])
  if (lastCall && hoursSince(lastCall.occurredAt, nowMs) < SEQUENCE_VOICE_DROP_FATIGUE_DEFAULTS.minHoursAfterCall) {
    return {
      allowed: false,
      code: "call_fatigue_window",
      message: `Call activity within ${SEQUENCE_VOICE_DROP_FATIGUE_DEFAULTS.minHoursAfterCall}h — defer voice drop.`,
    }
  }

  const compliance = await evaluateCommunicationComplianceForPhone(admin, {
    organizationId: input.organizationId,
    phoneNumber: toE164,
    channel: "voicemail",
    campaignType: "voicemail_drop",
    recentContactWithinCap: recentDelivery,
  })

  if (compliance.blocked) {
    const reason = compliance.reasons[0] ?? "compliance_blocked"
    if (reason === "opt_out") {
      return { allowed: false, code: "voice_opt_out", message: "Lead phone is on voice opt-out registry." }
    }
    if (reason === "outside_call_hours") {
      return { allowed: false, code: "outside_call_hours", message: "Outside configured call-hour window." }
    }
    return {
      allowed: false,
      code: "compliance_blocked",
      message: compliance.evidence[0] ?? "Compliance orchestration blocked voice drop.",
    }
  }

  return { allowed: true }
}
