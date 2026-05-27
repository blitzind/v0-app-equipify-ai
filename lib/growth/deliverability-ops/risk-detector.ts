import { buildEvidenceSnippet } from "@/lib/growth/deliverability-ops/deliverability-aggregator"
import type {
  GrowthDeliverabilityEntityType,
  GrowthDeliverabilityRiskType,
  GrowthDeliverabilitySeverity,
} from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export type DetectedDeliverabilityRisk = {
  riskType: GrowthDeliverabilityRiskType
  severity: GrowthDeliverabilitySeverity
  title: string
  description: string
  entityType: GrowthDeliverabilityEntityType
  entityId: string | null
  entityLabel: string
  signals: Record<string, unknown>
}

function risk(
  riskType: GrowthDeliverabilityRiskType,
  severity: GrowthDeliverabilitySeverity,
  title: string,
  description: string,
  entityType: GrowthDeliverabilityEntityType,
  entityId: string | null,
  entityLabel: string,
  signals: Record<string, unknown>,
): DetectedDeliverabilityRisk {
  return { riskType, severity, title, description, entityType, entityId, entityLabel, signals }
}

export type DeliverabilityRiskDetectorInput = {
  entityType?: GrowthDeliverabilityEntityType
  entityId?: string | null
  entityLabel?: string
  spfValid?: boolean
  dkimValid?: boolean
  dmarcValid?: boolean
  bounceRate?: number
  complaintRate?: number
  unsubscribeRate?: number
  openRate?: number
  previousOpenRate?: number
  clickRate?: number
  previousClickRate?: number
  replyRate?: number
  previousReplyRate?: number
  recentVolume?: number
  warmupProgress?: number
  warmupEnabled?: boolean
  providerHealthScore?: number
  previousProviderHealthScore?: number
  domainReputationScore?: number
  previousDomainReputationScore?: number
  rateLimitUtilizationPct?: number
  fatigueScore?: number
}

export function detectDeliverabilityRisks(input: DeliverabilityRiskDetectorInput): DetectedDeliverabilityRisk[] {
  const risks: DetectedDeliverabilityRisk[] = []
  const entityType = input.entityType ?? "platform"
  const entityId = input.entityId ?? null
  const entityLabel = input.entityLabel ?? "Platform"

  if (input.spfValid === false) {
    risks.push(
      risk(
        "spf_failure",
        "high",
        "SPF authentication failure",
        "SPF record missing or invalid — outbound mail may fail authentication.",
        entityType === "platform" ? "domain" : entityType,
        entityId,
        entityLabel,
        { spf_valid: false },
      ),
    )
  }

  if (input.dkimValid === false) {
    risks.push(
      risk(
        "dkim_failure",
        "high",
        "DKIM authentication failure",
        "DKIM record missing or invalid — message integrity may be questioned.",
        entityType === "platform" ? "domain" : entityType,
        entityId,
        entityLabel,
        { dkim_valid: false },
      ),
    )
  }

  if (input.dmarcValid === false) {
    risks.push(
      risk(
        "dmarc_failure",
        "medium",
        "DMARC policy gap",
        "DMARC not aligned — domain spoofing protection is incomplete.",
        entityType === "platform" ? "domain" : entityType,
        entityId,
        entityLabel,
        { dmarc_valid: false },
      ),
    )
  }

  const bounceRate = input.bounceRate ?? 0
  if (bounceRate >= 5) {
    risks.push(
      risk(
        "bounce_spike",
        bounceRate >= 10 ? "critical" : "high",
        "Bounce rate elevated",
        `Bounce rate at ${bounceRate.toFixed(1)}% exceeds healthy threshold.`,
        entityType,
        entityId,
        entityLabel,
        { bounce_rate: bounceRate, threshold: 5 },
      ),
    )
  }

  const complaintRate = input.complaintRate ?? 0
  if (complaintRate >= 0.1) {
    risks.push(
      risk(
        "complaint_spike",
        complaintRate >= 0.5 ? "critical" : "high",
        "Complaint rate elevated",
        `Spam complaint rate at ${complaintRate.toFixed(2)}%.`,
        entityType,
        entityId,
        entityLabel,
        { complaint_rate: complaintRate, threshold: 0.1 },
      ),
    )
  }

  const unsubscribeRate = input.unsubscribeRate ?? 0
  if (unsubscribeRate >= 1.5) {
    risks.push(
      risk(
        "unsubscribe_spike",
        unsubscribeRate >= 3 ? "critical" : "high",
        "Unsubscribe rate elevated",
        `Unsubscribe rate at ${unsubscribeRate.toFixed(1)}% may indicate list fatigue.`,
        entityType,
        entityId,
        entityLabel,
        { unsubscribe_rate: unsubscribeRate, threshold: 1.5 },
      ),
    )
  }

  const prevOpen = input.previousOpenRate ?? 0
  const curOpen = input.openRate ?? 0
  if (prevOpen > 0 && curOpen < prevOpen * 0.55) {
    risks.push(
      risk(
        "open_rate_drop",
        "medium",
        "Open rate dropped",
        `Open rate fell from ${prevOpen.toFixed(1)}% to ${curOpen.toFixed(1)}%.`,
        entityType,
        entityId,
        entityLabel,
        { previous_open_rate: prevOpen, current_open_rate: curOpen },
      ),
    )
  }

  const prevClick = input.previousClickRate ?? 0
  const curClick = input.clickRate ?? 0
  if (prevClick > 0 && curClick < prevClick * 0.5) {
    risks.push(
      risk(
        "click_rate_drop",
        "medium",
        "Click rate dropped",
        `Click rate fell from ${prevClick.toFixed(1)}% to ${curClick.toFixed(1)}%.`,
        entityType,
        entityId,
        entityLabel,
        { previous_click_rate: prevClick, current_click_rate: curClick },
      ),
    )
  }

  const prevReply = input.previousReplyRate ?? 0
  const curReply = input.replyRate ?? 0
  if (prevReply > 0 && curReply < prevReply * 0.45) {
    risks.push(
      risk(
        "reply_rate_drop",
        "high",
        "Reply rate dropped",
        `Reply rate fell from ${prevReply.toFixed(1)}% to ${curReply.toFixed(1)}%.`,
        entityType,
        entityId,
        entityLabel,
        { previous_reply_rate: prevReply, current_reply_rate: curReply },
      ),
    )
  }

  const fatigueScore = input.fatigueScore ?? 0
  const recentVolume = input.recentVolume ?? 0
  if (fatigueScore >= 65 || recentVolume >= 500) {
    risks.push(
      risk(
        "sender_fatigue",
        fatigueScore >= 80 || recentVolume >= 800 ? "critical" : "high",
        "Sender fatigue detected",
        "Recent volume or engagement trends indicate sender fatigue.",
        entityType === "platform" ? "sender" : entityType,
        entityId,
        entityLabel,
        { fatigue_score: fatigueScore, recent_volume: recentVolume },
      ),
    )
  }

  const warmupProgress = input.warmupProgress ?? 100
  if (input.warmupEnabled && warmupProgress < 60 && recentVolume >= 100) {
    risks.push(
      risk(
        "warmup_mismatch",
        "high",
        "Warmup volume mismatch",
        "Send volume exceeds warmup stage allowance.",
        entityType === "platform" ? "sender" : entityType,
        entityId,
        entityLabel,
        { warmup_progress: warmupProgress, recent_volume: recentVolume },
      ),
    )
  }

  const providerHealth = input.providerHealthScore ?? 100
  const prevProviderHealth = input.previousProviderHealthScore ?? providerHealth
  if (providerHealth < 55 || (prevProviderHealth > 0 && providerHealth < prevProviderHealth * 0.7)) {
    risks.push(
      risk(
        "provider_degradation",
        providerHealth < 40 ? "critical" : "high",
        "Provider health degraded",
        "Transport provider health score declined.",
        entityType === "platform" ? "provider" : entityType,
        entityId,
        entityLabel,
        { provider_health_score: providerHealth, previous: prevProviderHealth },
      ),
    )
  }

  const domainRep = input.domainReputationScore ?? 100
  const prevDomainRep = input.previousDomainReputationScore ?? domainRep
  if (domainRep < 55 || (prevDomainRep > 0 && domainRep < prevDomainRep - 15)) {
    risks.push(
      risk(
        "domain_reputation_drop",
        domainRep < 40 ? "critical" : "high",
        "Domain reputation declined",
        "Domain reputation score dropped versus prior period.",
        entityType === "platform" ? "domain" : entityType,
        entityId,
        entityLabel,
        { reputation_score: domainRep, previous: prevDomainRep },
      ),
    )
  }

  const rateLimitPct = input.rateLimitUtilizationPct ?? 0
  if (rateLimitPct >= 75) {
    risks.push(
      risk(
        "rate_limit_pressure",
        rateLimitPct >= 90 ? "critical" : "high",
        "Rate limit pressure",
        `Provider rate limit utilization at ${rateLimitPct.toFixed(0)}%.`,
        entityType === "platform" ? "route" : entityType,
        entityId,
        entityLabel,
        { rate_limit_utilization_pct: rateLimitPct, threshold: 75 },
      ),
    )
  }

  return risks
}

export function risksToEvidence(risk: DetectedDeliverabilityRisk) {
  const snippets = [
    buildEvidenceSnippet("Risk type", risk.riskType.replace(/_/g, " "), "risk_detector"),
    buildEvidenceSnippet("Severity", risk.severity, "risk_detector"),
    buildEvidenceSnippet("Entity", risk.entityLabel, "risk_detector"),
  ]
  for (const [key, value] of Object.entries(risk.signals)) {
    snippets.push(buildEvidenceSnippet(key.replace(/_/g, " "), String(value), "signal"))
  }
  return snippets
}
