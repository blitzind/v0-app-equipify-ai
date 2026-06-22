import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import {
  type WarmupStartupAction,
  warmupStartupUserMessage,
} from "@/lib/growth/warmup/warmup-startup-actions"
import { resolveWarmupStartupPlan } from "@/lib/growth/warmup/warmup-startup-plan"
import {
  createWarmupProfile,
  findWarmupProfileBySenderAccount,
  generateWarmupSchedule,
} from "@/lib/growth/warmup/warmup-repository"
import type { GrowthWarmupProfile } from "@/lib/growth/warmup/warmup-types"

export type WarmupStartupResult = {
  ok: boolean
  action: WarmupStartupAction
  message: string
  profile?: GrowthWarmupProfile
}

export async function startWarmupForSenderAccount(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    warmupDays?: number
    notes?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<WarmupStartupResult> {
  const senderAccountId = input.senderAccountId?.trim()
  if (!senderAccountId) {
    return {
      ok: false,
      action: "missing_sender",
      message: warmupStartupUserMessage({ action: "missing_sender" }),
    }
  }

  const sender = await getSenderAccount(admin, senderAccountId)
  if (!sender) {
    return {
      ok: false,
      action: "missing_sender",
      message: warmupStartupUserMessage({
        action: "missing_sender",
        reason: "sender account was not found",
      }),
    }
  }

  const actor = {
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  }

  let existing = await findWarmupProfileBySenderAccount(admin, senderAccountId)
  const plan = resolveWarmupStartupPlan(
    existing
      ? { status: existing.status, scheduleLength: existing.schedule?.length ?? 0 }
      : null,
  )

  try {
    if (plan === "create_and_generate") {
      existing = await createWarmupProfile(admin, {
        sender_account_id: senderAccountId,
        warmup_days: input.warmupDays,
        notes: input.notes ?? null,
        ...actor,
      })
      const profile = await generateWarmupSchedule(admin, existing.id, actor)
      return {
        ok: true,
        action: "created_and_generated",
        message: warmupStartupUserMessage({
          action: "created_and_generated",
          email: sender.email_address,
        }),
        profile,
      }
    }

    if (plan === "already_active") {
      return {
        ok: true,
        action: "already_active",
        message: warmupStartupUserMessage({
          action: "already_active",
          email: sender.email_address,
        }),
        profile: existing,
      }
    }

    const profile = await generateWarmupSchedule(admin, existing!.id, actor)
    return {
      ok: true,
      action: "generated_existing_new",
      message: warmupStartupUserMessage({
        action: "generated_existing_new",
        email: sender.email_address,
      }),
      profile,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error"
    return {
      ok: false,
      action: "schedule_generation_failed",
      message: warmupStartupUserMessage({
        action: "schedule_generation_failed",
        email: sender.email_address,
        reason,
      }),
    }
  }
}
