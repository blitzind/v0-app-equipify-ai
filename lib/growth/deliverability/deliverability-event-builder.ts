/** Deterministic deliverability event drafts from validation results. Client-safe. */

import type {
  GrowthDeliverabilityEventSeverity,
  GrowthDeliverabilityTimelineEventType,
} from "@/lib/growth/deliverability/deliverability-types"
import type { ValidateDnsDomainResult } from "@/lib/growth/deliverability/dns-validator"

export type DeliverabilityValidationEventDraft = {
  event_type: string
  severity: GrowthDeliverabilityEventSeverity
  title: string
  description: string
  timeline_type?: GrowthDeliverabilityTimelineEventType
  metadata?: Record<string, unknown>
}

export function buildDeliverabilityEventsFromValidation(
  domain: string,
  validation: ValidateDnsDomainResult,
  previousScore: number | null,
): DeliverabilityValidationEventDraft[] {
  const events: DeliverabilityValidationEventDraft[] = []

  if (!validation.spf_present || !validation.spf_valid) {
    events.push({
      event_type: "spf_missing",
      severity: "high",
      title: "SPF authentication missing",
      description: `${domain} is missing a valid SPF record.`,
      timeline_type: "spf_missing",
    })
  }
  if (!validation.dkim_present || !validation.dkim_valid) {
    events.push({
      event_type: "dkim_missing",
      severity: "high",
      title: "DKIM signing missing",
      description: `${domain} is missing a valid DKIM configuration.`,
      timeline_type: "dkim_missing",
    })
  }
  if (!validation.dmarc_present || !validation.dmarc_valid) {
    events.push({
      event_type: "dmarc_missing",
      severity: "medium",
      title: "DMARC policy missing",
      description: `${domain} is missing a valid DMARC policy.`,
      timeline_type: "dmarc_missing",
    })
  }

  if (validation.warnings.length > 0) {
    events.push({
      event_type: "domain_warning",
      severity: validation.health_tier === "critical" ? "critical" : "medium",
      title: "Domain DNS warnings detected",
      description: validation.warnings.slice(0, 3).join(" "),
      timeline_type: "domain_warning_created",
      metadata: { warning_count: validation.warnings.length },
    })
  }

  if (previousScore != null) {
    if (validation.dns_health_score < previousScore) {
      events.push({
        event_type: "dns_health_declined",
        severity: validation.dns_health_score < 40 ? "critical" : "high",
        title: "DNS health declined",
        description: `${domain} DNS health dropped from ${previousScore} to ${validation.dns_health_score}.`,
        timeline_type: "dns_health_declined",
        metadata: { previous_score: previousScore, current_score: validation.dns_health_score },
      })
    } else if (validation.dns_health_score > previousScore) {
      events.push({
        event_type: "deliverability_improved",
        severity: "low",
        title: "Deliverability improved",
        description: `${domain} deliverability score improved from ${previousScore} to ${validation.dns_health_score}.`,
        timeline_type: "deliverability_improved",
        metadata: { previous_score: previousScore, current_score: validation.dns_health_score },
      })
    }
  }

  return events
}
