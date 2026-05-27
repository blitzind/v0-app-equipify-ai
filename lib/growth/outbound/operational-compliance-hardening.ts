import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { classifyCampaignReply } from "@/lib/growth/outbound/reply-intelligence"

export type ComplianceViolation = {
  code: string
  severity: "medium" | "high" | "critical"
  message: string
}

export function detectUnsubscribeIntent(bodyPreview: string | null | undefined): boolean {
  const reply = classifyCampaignReply(bodyPreview)
  return reply.intent === "unsubscribe" || reply.engagementSignal === "stop"
}

export async function evaluateReplyCompliance(
  admin: SupabaseClient,
  input: {
    bodyPreview: string | null | undefined
    leadId?: string | null
    senderAccountId?: string | null
    sequenceEnrollmentId?: string | null
  },
): Promise<{ violations: ComplianceViolation[]; suppressFollowUp: boolean }> {
  const reply = classifyCampaignReply(input.bodyPreview)
  const violations: ComplianceViolation[] = []

  if (reply.intent === "unsubscribe") {
    violations.push({
      code: "unsubscribe_intent",
      severity: "critical",
      message: "Unsubscribe intent detected in reply.",
    })
  }
  if (reply.intent === "not_interested") {
    violations.push({
      code: "manual_stop_request",
      severity: "high",
      message: "Manual stop / not interested detected.",
    })
  }

  if (violations.length > 0) {
    await recordInternalOutboundAuditEvent(admin, {
      eventType: "pre_send_blocked",
      severity: "high",
      title: "Reply compliance signal",
      summary: violations.map((v) => v.message).join(" "),
      senderAccountId: input.senderAccountId ?? null,
      metadata: {
        lead_id: input.leadId,
        sequence_enrollment_id: input.sequenceEnrollmentId,
        intent: reply.intent,
        confidence: reply.confidence,
      },
    }).catch(() => undefined)
  }

  return { violations, suppressFollowUp: reply.suppressFollowUp }
}

export async function detectHighRiskCampaignSignals(
  admin: SupabaseClient,
  input: { sequenceEnrollmentId?: string | null; senderPoolId?: string | null },
): Promise<ComplianceViolation[]> {
  const violations: ComplianceViolation[] = []

  if (input.sequenceEnrollmentId) {
    const { data } = await admin
      .schema("growth")
      .from("campaign_engagement_metrics")
      .select("unsubscribe_intents, reply_quality_score, complaint_signals")
      .eq("sequence_enrollment_id", input.sequenceEnrollmentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      const row = data as Record<string, unknown>
      if (Number(row.unsubscribe_intents ?? 0) >= 2) {
        violations.push({
          code: "high_unsubscribe_velocity",
          severity: "critical",
          message: "Multiple unsubscribe intents on campaign — high risk.",
        })
      }
      if (Number(row.reply_quality_score ?? 100) < 35) {
        violations.push({
          code: "low_reply_quality",
          severity: "high",
          message: "Campaign reply quality degraded.",
        })
      }
    }
  }

  return violations
}
