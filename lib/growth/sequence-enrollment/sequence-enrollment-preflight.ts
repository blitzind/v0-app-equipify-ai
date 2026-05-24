import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
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
  options?: { patternId?: string | null },
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

  const { data: active } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id")
    .eq("lead_id", lead.id)
    .in("status", ["active", "paused"])
    .limit(1)
    .maybeSingle()

  if (active) {
    return { allowed: false, code: "active_enrollment", reason: "Lead already has an active sequence enrollment." }
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
