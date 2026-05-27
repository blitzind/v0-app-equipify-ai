import type {
  GrowthPerformanceRiskAlert,
  GrowthPerformanceRiskType,
  GrowthSequencePerformanceMetrics,
  GrowthSenderPerformanceMetrics,
  GrowthProviderPerformanceMetrics,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"

function alert(
  riskType: GrowthPerformanceRiskType,
  severity: GrowthPerformanceRiskAlert["severity"],
  title: string,
  description: string,
  entityType: string,
  entityId: string | null,
  metricValue: number,
  threshold: number,
): GrowthPerformanceRiskAlert {
  return { riskType, severity, title, description, entityType, entityId, metricValue, threshold }
}

export function detectSequencePerformanceRisks(input: {
  sequenceId: string | null
  metrics: GrowthSequencePerformanceMetrics
  previousReplyPct?: number
  previousMeetingPct?: number
}): GrowthPerformanceRiskAlert[] {
  const risks: GrowthPerformanceRiskAlert[] = []
  const id = input.sequenceId

  if (input.metrics.bounce_pct >= 8) {
    risks.push(
      alert(
        "bounce_spike",
        input.metrics.bounce_pct >= 15 ? "critical" : "high",
        "Bounce rate elevated",
        "Sequence bounce rate exceeds healthy threshold.",
        "sequence",
        id,
        input.metrics.bounce_pct,
        8,
      ),
    )
  }
  if (input.metrics.unsubscribe_pct >= 2) {
    risks.push(
      alert(
        "unsubscribe_spike",
        input.metrics.unsubscribe_pct >= 5 ? "critical" : "high",
        "Unsubscribe rate elevated",
        "Unsubscribe rate may indicate messaging fatigue.",
        "sequence",
        id,
        input.metrics.unsubscribe_pct,
        2,
      ),
    )
  }
  if (input.metrics.complaint_pct >= 0.1) {
    risks.push(
      alert(
        "complaint_spike",
        "critical",
        "Complaint rate elevated",
        "Spam complaints detected on sequence sends.",
        "sequence",
        id,
        input.metrics.complaint_pct,
        0.1,
      ),
    )
  }
  if (input.previousReplyPct != null && input.metrics.reply_pct < input.previousReplyPct * 0.5) {
    risks.push(
      alert(
        "reply_collapse",
        "high",
        "Reply rate collapsed",
        "Reply rate dropped sharply versus prior period.",
        "sequence",
        id,
        input.metrics.reply_pct,
        input.previousReplyPct * 0.5,
      ),
    )
  }
  if (input.previousMeetingPct != null && input.metrics.meeting_pct < input.previousMeetingPct * 0.5) {
    risks.push(
      alert(
        "meeting_drop",
        "medium",
        "Meeting rate dropped",
        "Meeting conversion declined versus prior period.",
        "sequence",
        id,
        input.metrics.meeting_pct,
        input.previousMeetingPct * 0.5,
      ),
    )
  }
  return risks
}

export function detectSenderPerformanceRisks(input: {
  senderAccountId: string
  metrics: GrowthSenderPerformanceMetrics
}): GrowthPerformanceRiskAlert[] {
  const risks: GrowthPerformanceRiskAlert[] = []
  if (input.metrics.fatigue_score >= 70) {
    risks.push(
      alert(
        "sender_fatigue",
        input.metrics.fatigue_score >= 85 ? "critical" : "high",
        "Sender fatigue detected",
        "Sender engagement and deliverability trends indicate fatigue.",
        "sender",
        input.senderAccountId,
        input.metrics.fatigue_score,
        70,
      ),
    )
  }
  if (input.metrics.bounce_trend >= 10) {
    risks.push(
      alert(
        "bounce_spike",
        "high",
        "Sender bounce trend rising",
        "Sender bounce trend exceeds threshold.",
        "sender",
        input.senderAccountId,
        input.metrics.bounce_trend,
        10,
      ),
    )
  }
  if (input.metrics.complaint_trend >= 0.15) {
    risks.push(
      alert(
        "complaint_spike",
        "critical",
        "Sender complaint trend rising",
        "Sender complaint trend requires review.",
        "sender",
        input.senderAccountId,
        input.metrics.complaint_trend,
        0.15,
      ),
    )
  }
  return risks
}

export function detectProviderPerformanceRisks(input: {
  providerId: string | null
  routeId: string | null
  metrics: GrowthProviderPerformanceMetrics
}): GrowthPerformanceRiskAlert[] {
  const risks: GrowthPerformanceRiskAlert[] = []
  const entityId = input.routeId ?? input.providerId
  if (input.metrics.failure_pct >= 10) {
    risks.push(
      alert(
        "provider_degradation",
        input.metrics.failure_pct >= 20 ? "critical" : "high",
        "Provider failure rate elevated",
        "Provider route failure rate exceeds threshold.",
        "provider_route",
        entityId,
        input.metrics.failure_pct,
        10,
      ),
    )
  }
  if (input.metrics.delivery_success_pct < 90 && input.metrics.delivery_success_pct > 0) {
    risks.push(
      alert(
        "provider_degradation",
        "medium",
        "Provider delivery success declining",
        "Delivery success rate below 90%.",
        "provider_route",
        entityId,
        input.metrics.delivery_success_pct,
        90,
      ),
    )
  }
  return risks
}

export function mergeRiskAlerts(alerts: GrowthPerformanceRiskAlert[], limit = 20): GrowthPerformanceRiskAlert[] {
  const severityRank = { critical: 4, high: 3, medium: 2 } as const
  return [...alerts]
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, limit)
}
