import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchDeliverabilityOverview } from "@/lib/growth/deliverability/deliverability-repository"
import { isGrowthDnsDeliverabilitySchemaReady } from "@/lib/growth/deliverability/deliverability-schema-health"
import {
  GROWTH_DELIVERABILITY_DNS_HEALTH_QA_MARKER,
  GROWTH_DELIVERABILITY_DEGRADED_MODE_QA_MARKER,
  GROWTH_DELIVERABILITY_MODULE_STILL_AVAILABLE,
  GROWTH_DELIVERABILITY_OPS_V2_QA_MARKER,
  GROWTH_DELIVERABILITY_PROTECTION_MODULE_IDS,
  GROWTH_DELIVERABILITY_QUEUE_OPS_QA_MARKER,
  GROWTH_DELIVERABILITY_SENDER_HEALTH_QA_MARKER,
  GROWTH_DELIVERABILITY_WIDGET_FALLBACK_QA_MARKER,
  type GrowthDeliverabilityDnsHealthModule,
  type GrowthDeliverabilityModuleResult,
  type GrowthDeliverabilityOpsAlert,
  type GrowthDeliverabilityProtectionConsoleSnapshot,
  type GrowthDeliverabilityProtectionModuleId,
  type GrowthDeliverabilityQueueOpsModule,
  type GrowthDeliverabilityReputationModule,
  type GrowthDeliverabilitySenderHealthModule,
  type GrowthDeliverabilitySequenceSafetyModule,
} from "@/lib/growth/deliverability/deliverability-protection-console-types"
import { isGrowthDeliverabilityReputationProtectionSchemaReady } from "@/lib/growth/deliverability/reputation-protection-schema-health"
import { GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE } from "@/lib/growth/deliverability/reputation-protection-types"
import { evaluateSendThrottle } from "@/lib/growth/deliverability/send-throttle-engine"
import { loadSenderDeliverabilityPauseState } from "@/lib/growth/deliverability/sender-pause-state"
import { listOutreachQueueRecoveryItems } from "@/lib/growth/outreach/outreach-queue-recovery"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import {
  assessAllMailboxReputations,
  buildReputationTrendSections,
  loadMailboxSendPolicy,
} from "@/lib/growth/deliverability/mailbox-reputation-repository"

const MODULE_QA: Record<GrowthDeliverabilityProtectionModuleId, string> = {
  sender_health: GROWTH_DELIVERABILITY_SENDER_HEALTH_QA_MARKER,
  queue_ops: GROWTH_DELIVERABILITY_QUEUE_OPS_QA_MARKER,
  reputation_protection: GROWTH_DELIVERABILITY_DEGRADED_MODE_QA_MARKER,
  dns_health: GROWTH_DELIVERABILITY_DNS_HEALTH_QA_MARKER,
  sequence_safety: GROWTH_DELIVERABILITY_WIDGET_FALLBACK_QA_MARKER,
}

async function safeModule<T>(
  moduleId: GrowthDeliverabilityProtectionModuleId,
  builder: () => Promise<T>,
  options?: {
    isEmpty?: (data: T) => boolean
    emptyMessage?: string
  },
): Promise<GrowthDeliverabilityModuleResult<T>> {
  const fetchedAt = new Date().toISOString()
  try {
    const data = await builder()
    if (options?.isEmpty?.(data)) {
      return {
        module_id: moduleId,
        status: "empty",
        qa_marker: MODULE_QA[moduleId],
        data,
        error: {
          code: "not_configured",
          message: options.emptyMessage ?? "No live data connected for this module yet.",
          impact: "This section shows guidance only until telemetry is connected.",
          remediation: "Connect sender mailboxes, DNS checks, or outbound queue infrastructure.",
          retryable: true,
        },
        last_success_at: fetchedAt,
        fetched_at: fetchedAt,
        still_available: GROWTH_DELIVERABILITY_MODULE_STILL_AVAILABLE[moduleId],
      }
    }
    return {
      module_id: moduleId,
      status: "ok",
      qa_marker: MODULE_QA[moduleId],
      data,
      error: null,
      last_success_at: fetchedAt,
      fetched_at: fetchedAt,
      still_available: GROWTH_DELIVERABILITY_MODULE_STILL_AVAILABLE[moduleId],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[deliverability-console:${moduleId}]`, message)
    return {
      module_id: moduleId,
      status: "error",
      qa_marker: MODULE_QA[moduleId],
      data: null,
      error: {
        code: "module_fetch_failed",
        message,
        impact: `${formatModuleLabel(moduleId)} is unavailable. Other deliverability modules remain active.`,
        remediation: "Retry this module or check Growth schema migrations and provider connections.",
        retryable: true,
      },
      last_success_at: null,
      fetched_at: fetchedAt,
      still_available: GROWTH_DELIVERABILITY_MODULE_STILL_AVAILABLE[moduleId],
    }
  }
}

function formatModuleLabel(moduleId: GrowthDeliverabilityProtectionModuleId): string {
  return moduleId.replace(/_/g, " ")
}

async function countOutreachStatus(admin: SupabaseClient, status: string): Promise<number> {
  const { count } = await admin
    .schema("growth")
    .from("outreach_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
  return count ?? 0
}

export async function buildSenderHealthModule(
  admin: SupabaseClient,
): Promise<GrowthDeliverabilityModuleResult<GrowthDeliverabilitySenderHealthModule>> {
  return safeModule(
    "sender_health",
    async () => {
      const ready = await isGrowthDeliverabilityReputationProtectionSchemaReady(admin)
      if (!ready) throw new Error("Reputation protection schema not ready.")

      const assessments = await assessAllMailboxReputations(admin)
      const senders = await listSenderAccounts(admin)
      const atRisk = assessments.filter((row) =>
        ["caution", "high_risk", "protected"].includes(row.health_tier),
      )
      const paused = assessments.filter((row) => row.health_tier === "paused")
      const warming = assessments.filter((row) => row.health_tier === "warming")

      const pauseStates = await Promise.all(
        senders.slice(0, 24).map(async (sender) => {
          const pause = await loadSenderDeliverabilityPauseState(admin, sender.id)
          return pause?.paused ? sender.email_address : null
        }),
      )

      const sending_limits = await Promise.all(
        assessments.slice(0, 12).map(async (row) => {
          const policy = await loadMailboxSendPolicy(admin, row.metrics.sender_account_id)
          const throttle = evaluateSendThrottle({ policy, assessment: row })
          return {
            email: row.metrics.email_address,
            daily_used: row.metrics.daily_send_count,
            daily_cap: policy.daily_send_cap,
            cap_utilization_pct:
              policy.daily_send_cap > 0
                ? Math.round((row.metrics.daily_send_count / policy.daily_send_cap) * 100)
                : 0,
            throttled: throttle.throttled,
          }
        }),
      )

      const unhealthy_domains = new Set(
        assessments
          .filter((row) => row.metrics.bounce_rate >= 5 || row.metrics.spam_complaint_rate >= 0.3)
          .map((row) => row.metrics.email_address.split("@")[1] ?? row.metrics.email_address),
      )

      const provider_warnings = assessments
        .flatMap((row) => row.risk_reasons)
        .filter(Boolean)
        .slice(0, 4)

      return {
        summary: {
          total_mailboxes: assessments.length,
          active_mailboxes: assessments.length - paused.length,
          paused_mailboxes: paused.length,
          warming_mailboxes: warming.length,
          unhealthy_domains: unhealthy_domains.size,
          average_risk_score:
            assessments.length > 0
              ? Math.round(assessments.reduce((sum, row) => sum + row.risk_score, 0) / assessments.length)
              : 100,
        },
        at_risk: atRisk.slice(0, 8).map((row) => ({
          email: row.metrics.email_address,
          health_tier: row.health_tier,
          risk_score: row.risk_score,
          bounce_rate: row.metrics.bounce_rate,
          complaint_rate: row.metrics.spam_complaint_rate,
          primary_reason: row.risk_reasons[0] ?? null,
          recommended_action: row.recommended_actions[0] ?? null,
        })),
        paused: [
          ...paused.slice(0, 6).map((row) => ({
            email: row.metrics.email_address,
            pause_reason: row.risk_reasons[0] ?? "Reputation protection paused this mailbox.",
            paused_at: null as string | null,
            recommended_action: row.recommended_actions[0] ?? "Review pause reason before resuming sends.",
          })),
          ...pauseStates
            .filter((email): email is string => Boolean(email))
            .slice(0, 4)
            .map((email) => ({
              email,
              pause_reason: "Persistent deliverability pause enforcement",
              paused_at: null,
              recommended_action: "Clear pause state after remediation.",
            })),
        ],
        provider_warnings,
        sending_limits,
      }
    },
    {
      isEmpty: (data) => data.summary.total_mailboxes === 0,
      emptyMessage: "No mailbox telemetry connected.",
    },
  )
}

export async function buildQueueOpsModule(
  admin: SupabaseClient,
): Promise<GrowthDeliverabilityModuleResult<GrowthDeliverabilityQueueOpsModule>> {
  return safeModule(
    "queue_ops",
    async () => {
      const [
        pendingApproval,
        scheduled,
        failed,
        deadLetter,
        approved,
        overdueScheduled,
        stuckProcessing,
        recoveryItems,
        seqPending,
      ] = await Promise.all([
        countOutreachStatus(admin, "pending_approval").catch(() => 0),
        countOutreachStatus(admin, "scheduled").catch(() => 0),
        countOutreachStatus(admin, "failed").catch(() => 0),
        countOutreachStatus(admin, "dead_letter").catch(() => 0),
        countOutreachStatus(admin, "approved").catch(() => 0),
        admin
          .schema("growth")
          .from("outreach_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "scheduled")
          .lte("scheduled_for", new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .then((res) => res.count ?? 0)
          .catch(() => 0),
        admin
          .schema("growth")
          .from("outreach_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .not("processing_started_at", "is", null)
          .lte("processing_started_at", new Date(Date.now() - 20 * 60 * 1000).toISOString())
          .then((res) => res.count ?? 0)
          .catch(() => 0),
        listOutreachQueueRecoveryItems(admin, 8).catch(() => []),
        admin
          .schema("growth")
          .from("sequence_execution_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_approval")
          .then((res) => res.count ?? 0)
          .catch(() => 0),
      ])

      return {
        pending_outbound: scheduled + approved,
        blocked_sends: pendingApproval,
        failed_sends: failed,
        dead_letter_queue: deadLetter,
        retry_queue: failed + deadLetter,
        approval_bottlenecks: pendingApproval + seqPending,
        overdue_scheduled: overdueScheduled,
        stuck_processing: stuckProcessing,
        recovery_items: recoveryItems.map((item) => ({
          id: item.queue_id,
          status: item.status,
          label: item.company_name ?? item.queue_id,
          failure_reason: item.failure_reason ?? null,
        })),
        configured: true,
      }
    },
    {
      isEmpty: (data) =>
        data.pending_outbound === 0 &&
        data.failed_sends === 0 &&
        data.dead_letter_queue === 0 &&
        data.recovery_items.length === 0,
      emptyMessage: "No outbound queue telemetry available.",
    },
  )
}

export async function buildReputationProtectionModule(
  admin: SupabaseClient,
): Promise<GrowthDeliverabilityModuleResult<GrowthDeliverabilityReputationModule>> {
  return safeModule(
    "reputation_protection",
    async () => {
      const ready = await isGrowthDeliverabilityReputationProtectionSchemaReady(admin)
      if (!ready) throw new Error("Reputation protection schema not ready.")

      const assessments = await assessAllMailboxReputations(admin)
      const trends = buildReputationTrendSections(assessments)

      const bounceRates = assessments.map((row) => row.metrics.bounce_rate)
      const complaintRates = assessments.map((row) => row.metrics.spam_complaint_rate)
      const avg = (values: number[]) =>
        values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null

      const unsubscribeSpike = assessments.filter((row) => row.metrics.unsubscribe_rate >= 2).length
      const spamTrapRisk = assessments.filter(
        (row) => row.metrics.bounce_rate >= 8 || row.metrics.spam_complaint_rate >= 0.5,
      ).length

      const domainMap = new Map<string, { total: number; count: number; tier: string }>()
      for (const row of assessments) {
        const domain = row.metrics.email_address.split("@")[1] ?? "unknown"
        const existing = domainMap.get(domain) ?? { total: 0, count: 0, tier: row.health_tier }
        existing.total += row.risk_score
        existing.count += 1
        if (row.health_tier === "high_risk" || row.health_tier === "paused") {
          existing.tier = row.health_tier
        }
        domainMap.set(domain, existing)
      }

      const domain_reputation_issues = [...domainMap.entries()]
        .map(([domain, stats]) => ({
          domain,
          score: Math.round(stats.total / stats.count),
          tier: stats.tier,
        }))
        .filter((row) => row.score < 70 || row.tier === "high_risk" || row.tier === "paused")
        .slice(0, 6)

      const provider_reputation_issues = assessments
        .filter((row) => row.health_tier === "high_risk" || row.health_tier === "paused")
        .map((row) => `${row.metrics.email_address}: ${row.risk_reasons[0] ?? "elevated reputation risk"}`)
        .slice(0, 5)

      return {
        bounce_rate_pct: avg(bounceRates),
        complaint_rate_pct: avg(complaintRates),
        unsubscribe_spike_count: unsubscribeSpike,
        spam_trap_risk_count: spamTrapRisk,
        domain_reputation_issues,
        provider_reputation_issues,
        bounce_trends: trends.bounce_trends,
        complaint_trends: trends.complaint_trends,
        telemetry_connected: assessments.length > 0,
      }
    },
    {
      isEmpty: (data) => !data.telemetry_connected,
      emptyMessage: "No provider health data available.",
    },
  )
}

export async function buildDnsHealthModule(
  admin: SupabaseClient,
): Promise<GrowthDeliverabilityModuleResult<GrowthDeliverabilityDnsHealthModule>> {
  return safeModule(
    "dns_health",
    async () => {
      const ready = await isGrowthDnsDeliverabilitySchemaReady(admin)
      if (!ready) throw new Error("DNS deliverability schema not ready.")

      const overview = await fetchDeliverabilityOverview(admin)
      const domains = overview.domains

      const spf_ok = domains.filter((row) => row.spf_valid).length
      const dkim_ok = domains.filter((row) => row.dkim_valid).length
      const dmarc_ok = domains.filter((row) => row.dmarc_valid).length
      const mx_ok = domains.filter((row) => row.mx_valid).length

      const failing_domains = domains
        .filter((row) => row.health_tier === "critical" || row.health_tier === "degraded" || row.health_tier === "warning")
        .slice(0, 8)
        .map((row) => ({
          domain: row.domain,
          issues: row.recommendations.length > 0 ? row.recommendations.slice(0, 3) : ["Authentication incomplete"],
          health_tier: row.health_tier,
        }))

      const warmup_readiness_issues = domains
        .filter((row) => !row.spf_valid || !row.dkim_valid || !row.dmarc_valid)
        .map((row) => `${row.domain}: complete SPF/DKIM/DMARC before scaling warmup`)
        .slice(0, 5)

      return {
        domains_tracked: domains.length,
        spf_ok,
        dkim_ok,
        dmarc_ok,
        mx_ok,
        failing_domains,
        warmup_readiness_issues,
        monitoring_configured: domains.length > 0,
      }
    },
    {
      isEmpty: (data) => !data.monitoring_configured,
      emptyMessage: "Deliverability monitoring not configured.",
    },
  )
}

export async function buildSequenceSafetyModule(
  admin: SupabaseClient,
): Promise<GrowthDeliverabilityModuleResult<GrowthDeliverabilitySequenceSafetyModule>> {
  return safeModule(
    "sequence_safety",
    async () => {
      const ready = await isGrowthDeliverabilityReputationProtectionSchemaReady(admin)
      if (!ready) throw new Error("Reputation protection schema not ready.")

      const assessments = await assessAllMailboxReputations(admin)
      const risky_sequences = assessments
        .filter((row) => row.metrics.sequence_participation_count > 0)
        .slice(0, 8)
        .map((row) => ({
          label: row.metrics.email_address,
          sequence_count: row.metrics.sequence_participation_count,
          risk_score: row.risk_score,
        }))

      const high_complaint_senders = assessments
        .filter((row) => row.metrics.spam_complaint_rate >= 0.2)
        .slice(0, 6)
        .map((row) => ({
          email: row.metrics.email_address,
          complaint_rate: row.metrics.spam_complaint_rate,
        }))

      const throttled_campaigns = (
        await Promise.all(
          assessments.slice(0, 12).map(async (row) => {
            const policy = await loadMailboxSendPolicy(admin, row.metrics.sender_account_id)
            const throttle = evaluateSendThrottle({ policy, assessment: row })
            return throttle.throttled ? 1 : 0
          }),
        )
      ).reduce((sum, value) => sum + value, 0)

      const auto_paused_outreach = assessments.filter((row) => row.health_tier === "paused").length

      return {
        risky_sequences,
        high_complaint_senders,
        throttled_campaigns,
        auto_paused_outreach,
        configured: assessments.some((row) => row.metrics.sequence_participation_count > 0),
      }
    },
    {
      isEmpty: (data) => !data.configured && data.risky_sequences.length === 0,
      emptyMessage: "No active sequence participation tracked.",
    },
  )
}

const MODULE_BUILDERS: Record<
  GrowthDeliverabilityProtectionModuleId,
  (admin: SupabaseClient) => Promise<GrowthDeliverabilityModuleResult<unknown>>
> = {
  sender_health: buildSenderHealthModule,
  queue_ops: buildQueueOpsModule,
  reputation_protection: buildReputationProtectionModule,
  dns_health: buildDnsHealthModule,
  sequence_safety: buildSequenceSafetyModule,
}

export async function buildDeliverabilityProtectionModule(
  admin: SupabaseClient,
  moduleId: GrowthDeliverabilityProtectionModuleId,
): Promise<GrowthDeliverabilityModuleResult<unknown>> {
  const builder = MODULE_BUILDERS[moduleId]
  if (!builder) throw new Error("unknown_module")
  return builder(admin)
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

export async function buildDeliverabilityProtectionConsole(
  admin: SupabaseClient,
): Promise<GrowthDeliverabilityProtectionConsoleSnapshot> {
  const moduleResults = await Promise.all(
    GROWTH_DELIVERABILITY_PROTECTION_MODULE_IDS.map((moduleId) =>
      buildDeliverabilityProtectionModule(admin, moduleId),
    ),
  )

  const modules = Object.fromEntries(
    moduleResults.map((result) => [result.module_id, result]),
  ) as Record<GrowthDeliverabilityProtectionModuleId, GrowthDeliverabilityModuleResult<unknown>>

  const degraded_mode = moduleResults.some((result) => result.status === "error" || result.status === "empty")

  return {
    qa_marker: GROWTH_DELIVERABILITY_OPS_V2_QA_MARKER,
    generated_at: new Date().toISOString(),
    modules,
    alerts: buildDeliverabilityOpsAlerts(modules),
    degraded_mode,
    privacy_note: GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE,
  }
}
