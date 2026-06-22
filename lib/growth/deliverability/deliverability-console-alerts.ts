import type {
  GrowthDeliverabilityDnsHealthModule,
  GrowthDeliverabilityModuleResult,
  GrowthDeliverabilityOpsAlert,
  GrowthDeliverabilityProtectionModuleId,
  GrowthDeliverabilityQueueOpsModule,
  GrowthDeliverabilityReputationModule,
  GrowthDeliverabilitySenderHealthModule,
  GrowthDeliverabilitySequenceSafetyModule,
} from "@/lib/growth/deliverability/deliverability-protection-console-types"

function severityRank(severity: GrowthDeliverabilityOpsAlert["severity"]): number {
  switch (severity) {
    case "critical":
      return 4
    case "high":
      return 3
    case "medium":
      return 2
    default:
      return 1
  }
}

export function buildDeliverabilityOpsAlerts(
  modules: Record<GrowthDeliverabilityProtectionModuleId, GrowthDeliverabilityModuleResult<unknown>>,
): GrowthDeliverabilityOpsAlert[] {
  const alerts: GrowthDeliverabilityOpsAlert[] = []

  const sender = modules.sender_health.data as GrowthDeliverabilitySenderHealthModule | null
  if (sender && sender.summary.paused_mailboxes > 0) {
    alerts.push({
      id: "paused-mailboxes",
      severity: "critical",
      title: "Paused mailboxes require review",
      summary: `${sender.summary.paused_mailboxes} mailbox(es) paused by reputation protection.`,
      impact: "Outbound from paused senders is blocked until operator clears pause state.",
      action_label: "Review paused senders",
      action_href: "#sender-health",
      entity_labels: sender.paused.slice(0, 4).map((row) => row.email),
    })
  }

  const dns = modules.dns_health.data as GrowthDeliverabilityDnsHealthModule | null
  if (dns && dns.failing_domains.length > 0) {
    alerts.push({
      id: "dns-failures",
      severity: "high",
      title: "DNS authentication failures detected",
      summary: `${dns.failing_domains.length} domain(s) have SPF/DKIM/DMARC issues.`,
      impact: "Authentication gaps increase spam placement and provider throttling.",
      action_label: "Open DNS health",
      action_href: "#dns-health",
      entity_labels: dns.failing_domains.map((row) => row.domain),
    })
  }

  const queue = modules.queue_ops.data as GrowthDeliverabilityQueueOpsModule | null
  if (queue && (queue.failed_sends > 0 || queue.dead_letter_queue > 0)) {
    alerts.push({
      id: "outbound-failures",
      severity: queue.dead_letter_queue > 0 ? "critical" : "high",
      title: "Outbound queue failures need recovery",
      summary: `${queue.failed_sends} failed · ${queue.dead_letter_queue} dead-letter.`,
      impact: "Prospects in failed/dead-letter states will not receive outreach until replayed.",
      action_label: "Review queue ops",
      action_href: "#queue-ops",
      entity_labels: queue.recovery_items.slice(0, 4).map((row) => row.label),
    })
  }

  const reputation = modules.reputation_protection.data as GrowthDeliverabilityReputationModule | null
  if (reputation && reputation.spam_trap_risk_count > 0) {
    alerts.push({
      id: "spam-risk",
      severity: "high",
      title: "Spam-risk senders detected",
      summary: `${reputation.spam_trap_risk_count} mailbox(es) exceed bounce/complaint thresholds.`,
      impact: "Continued sending risks provider blocks and domain reputation damage.",
      action_label: "Review reputation",
      action_href: "#reputation-protection",
      entity_labels: reputation.provider_reputation_issues.slice(0, 3),
    })
  }

  const sequence = modules.sequence_safety.data as GrowthDeliverabilitySequenceSafetyModule | null
  if (sequence && sequence.auto_paused_outreach > 0) {
    alerts.push({
      id: "auto-paused-sequences",
      severity: "medium",
      title: "Auto-paused outreach on risky senders",
      summary: `${sequence.auto_paused_outreach} sender(s) paused while enrolled in sequences.`,
      impact: "Sequence steps may stall or fail pre-send deliverability gates.",
      action_label: "Review sequence safety",
      action_href: "#sequence-safety",
      entity_labels: sequence.risky_sequences.slice(0, 3).map((row) => row.label),
    })
  }

  return alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
}
