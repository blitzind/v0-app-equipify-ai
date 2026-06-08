/** Rule-based channel selection intelligence (Phase 5.4F). Client-safe. */

import type { GrowthSequenceTouch } from "@/lib/growth/sequence-types"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"

export const SEQUENCE_CHANNEL_RULE_DEFAULTS = {
  emailNoReplyDaysBeforeSms: 3,
  positiveSmsReplyStopsColdOutreach: true,
  callCompletedSkipsRedundantEmail: true,
  voiceDropMinHoursAfterSms: 24,
  voiceDropMinHoursAfterCall: 12,
  voiceDropCooldownDays: 7,
} as const

export type SequenceChannelSelectionRuleCode =
  | "email_no_reply_escalate_sms"
  | "positive_sms_reply_pause_cold"
  | "call_completed_adjust_next"
  | "voice_drop_cooldown_skip"
  | "voice_drop_sms_fatigue_skip"
  | "voice_drop_call_fatigue_skip"
  | "none"

export type SequenceChannelSelectionDecision = {
  ruleCode: SequenceChannelSelectionRuleCode
  action: "proceed" | "skip_step" | "pause_enrollment" | "advance_early"
  reason: string
  targetStepOrder?: number
}

function daysSince(iso: string, nowMs: number): number {
  return (nowMs - Date.parse(iso)) / (24 * 60 * 60 * 1000)
}

function lastTouchByChannel(touches: GrowthSequenceTouch[], channel: string): GrowthSequenceTouch | null {
  const filtered = touches.filter((touch) => touch.channel === channel)
  return filtered.length > 0 ? filtered[filtered.length - 1]! : null
}

function hasPositiveSmsReply(touches: GrowthSequenceTouch[]): boolean {
  return touches.some(
    (touch) =>
      touch.channel === "reply" &&
      typeof touch.signalKind === "string" &&
      /positive|interested|yes|book|meeting/i.test(touch.signalKind),
  )
}

export function evaluateSequenceChannelSelectionRules(input: {
  steps: GrowthSequenceEnrollmentStep[]
  currentStep: GrowthSequenceEnrollmentStep
  touches: GrowthSequenceTouch[]
  nowMs?: number
}): SequenceChannelSelectionDecision {
  const nowMs = input.nowMs ?? Date.now()
  const { currentStep, touches } = input

  if (
    SEQUENCE_CHANNEL_RULE_DEFAULTS.positiveSmsReplyStopsColdOutreach &&
    currentStep.channel === "email" &&
    hasPositiveSmsReply(touches)
  ) {
    const priorSms = lastTouchByChannel(touches, "sms")
    if (priorSms) {
      return {
        ruleCode: "positive_sms_reply_pause_cold",
        action: "pause_enrollment",
        reason: "Positive SMS reply detected — stop future cold outreach in this sequence.",
      }
    }
  }

  if (currentStep.channel === "sms") {
    const lastEmail = lastTouchByChannel(touches, "email")
    const lastReply = lastTouchByChannel(touches, "reply")
    if (
      lastEmail &&
      !lastReply &&
      daysSince(lastEmail.occurredAt, nowMs) >= SEQUENCE_CHANNEL_RULE_DEFAULTS.emailNoReplyDaysBeforeSms
    ) {
      return {
        ruleCode: "email_no_reply_escalate_sms",
        action: "proceed",
        reason: `No email reply after ${SEQUENCE_CHANNEL_RULE_DEFAULTS.emailNoReplyDaysBeforeSms}+ days — SMS step proceeds.`,
      }
    }
  }

  if (currentStep.channel === "voice_drop") {
    const lastVoiceDrop = lastTouchByChannel(touches, "voice_drop")
    if (
      lastVoiceDrop &&
      daysSince(lastVoiceDrop.occurredAt, nowMs) < SEQUENCE_CHANNEL_RULE_DEFAULTS.voiceDropCooldownDays
    ) {
      return {
        ruleCode: "voice_drop_cooldown_skip",
        action: "skip_step",
        reason: `Voice drop cooldown (${SEQUENCE_CHANNEL_RULE_DEFAULTS.voiceDropCooldownDays} days) — skip step.`,
      }
    }

    const lastSms = lastTouchByChannel(touches, "sms")
    if (
      lastSms &&
      daysSince(lastSms.occurredAt, nowMs) * 24 < SEQUENCE_CHANNEL_RULE_DEFAULTS.voiceDropMinHoursAfterSms
    ) {
      return {
        ruleCode: "voice_drop_sms_fatigue_skip",
        action: "skip_step",
        reason: `SMS within ${SEQUENCE_CHANNEL_RULE_DEFAULTS.voiceDropMinHoursAfterSms}h — defer voice drop step.`,
      }
    }

    const lastCall = lastTouchByChannel(touches, "manual_call") ?? lastTouchByChannel(touches, "call")
    if (
      lastCall &&
      daysSince(lastCall.occurredAt, nowMs) * 24 < SEQUENCE_CHANNEL_RULE_DEFAULTS.voiceDropMinHoursAfterCall
    ) {
      return {
        ruleCode: "voice_drop_call_fatigue_skip",
        action: "skip_step",
        reason: `Call within ${SEQUENCE_CHANNEL_RULE_DEFAULTS.voiceDropMinHoursAfterCall}h — defer voice drop step.`,
      }
    }
  }

  if (
    SEQUENCE_CHANNEL_RULE_DEFAULTS.callCompletedSkipsRedundantEmail &&
    currentStep.channel === "email" &&
    currentStep.stepOrder > 1
  ) {
    const priorCall = touches.find(
      (touch) =>
        (touch.channel === "manual_call" || touch.channel === "call") &&
        typeof touch.signalKind === "string" &&
        /connected|interested|meeting|completed/i.test(touch.signalKind),
    )
    if (priorCall) {
      const priorStep = input.steps.find((step) => step.stepOrder === currentStep.stepOrder - 1)
      if (priorStep && (priorStep.channel === "call" || priorStep.channel === "manual_call")) {
        return {
          ruleCode: "call_completed_adjust_next",
          action: "proceed",
          reason: "Call completed with positive signal — email follow-up proceeds with warm context.",
        }
      }
    }
  }

  return {
    ruleCode: "none",
    action: "proceed",
    reason: "No channel selection rule applied.",
  }
}

export function shouldSkipStepByChannelRules(decision: SequenceChannelSelectionDecision): boolean {
  return decision.action === "skip_step"
}

export function shouldPauseEnrollmentByChannelRules(decision: SequenceChannelSelectionDecision): boolean {
  return decision.action === "pause_enrollment"
}
