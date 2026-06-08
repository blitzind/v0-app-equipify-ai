import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { validateGrowthSequencePatternVoiceDropActivation } from "@/lib/growth/sequences/sequence-voice-drop-pattern-readiness"
import { runGrowthOutreachPreflight } from "@/lib/growth/outreach/outreach-preflight"
import type { GrowthLead } from "@/lib/growth/types"

export type SequenceEnrollmentPreflightResult = {
  allowed: boolean
  code?: string
  reason?: string
}

export async function runSequenceEnrollmentPreflight(
  admin: SupabaseClient,
  lead: GrowthLead,
  options?: { patternId?: string | null; excludeEnrollmentId?: string | null },
): Promise<SequenceEnrollmentPreflightResult> {
  if (lead.contactTemperature === "suppressed" || lead.status === "disqualified" || lead.status === "archived") {
    return { allowed: false, code: "lead_blocked", reason: "Lead is not eligible for sequence enrollment." }
  }

  if (lead.sequenceFatigueRisk === "high") {
    return { allowed: false, code: "fatigue_blocked", reason: "Sequence fatigue risk is high — pause before enrolling." }
  }

  const explicitPattern = options?.patternId ?? null
  if ((lead.recommendedSequenceConfidence ?? 0) < 40 && !lead.recommendedSequencePatternId && !explicitPattern) {
    return { allowed: false, code: "low_confidence", reason: "No confident sequence recommendation available." }
  }

  const emailPreflight = await runGrowthOutreachPreflight(admin, {
    lead,
    channel: "email",
    toEmail: lead.contactEmail,
    generationType: "follow_up_email",
    generationApproved: false,
  })
  if (!emailPreflight.allowed && emailPreflight.code === "suppressed") {
    return emailPreflight
  }

  let activeQuery = admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, sequence_pattern_id, status")
    .eq("lead_id", lead.id)
    .in("status", ["draft", "active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)

  if (options?.excludeEnrollmentId) {
    activeQuery = activeQuery.neq("id", options.excludeEnrollmentId)
  }

  const { data: active, error: activeError } = await activeQuery.maybeSingle()
  if (activeError) throw new Error(activeError.message)

  if (active) {
    return {
      allowed: false,
      code: "active_enrollment",
      reason: "Lead already has another sequence enrollment in progress.",
    }
  }

  const patternId = explicitPattern ?? lead.recommendedSequencePatternId
  if (patternId) {
    const patterns = await listGrowthSequencePatterns(admin)
    const pattern = patterns.find((entry) => entry.id === patternId)
    if (pattern && !pattern.isActive) {
      return {
        allowed: false,
        code: "pattern_not_active",
        reason: "Sequence pattern is not active — configure Voice Drop campaigns in Sequence Builder first.",
      }
    }
    if (pattern) {
      const voiceDropReady = validateGrowthSequencePatternVoiceDropActivation(pattern)
      if (!voiceDropReady.ok) {
        return {
          allowed: false,
          code: voiceDropReady.code ?? "voice_drop_campaign_required",
          reason: voiceDropReady.message ?? "Voice Drop campaign required.",
        }
      }
    }
  }

  return { allowed: true }
}

export async function runSequenceEnrollmentPreflightForLeadId(
  admin: SupabaseClient,
  leadId: string,
): Promise<SequenceEnrollmentPreflightResult> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return { allowed: false, code: "not_found", reason: "Lead not found." }
  return runSequenceEnrollmentPreflight(admin, lead)
}
