import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isOutboundOutageAlert } from "@/lib/growth/operations/outbound-cron-health-operator-types"
import { fetchGrowthOutboundOperationsDashboard } from "@/lib/growth/operations/outbound-operations-dashboard"
import {
  GROWTH_OPERATOR_UX_H3_QA_MARKER,
  type GrowthOperatorAttentionItem,
  type GrowthOperatorAttentionStrip,
} from "@/lib/growth/operator-ux/operator-ux-h3-types"
import { fetchGrowthAttentionDashboard } from "@/lib/growth/notifications/notification-repository"
import { isAdapterOutboundExecutionEnabled } from "@/lib/growth/runtime/outbound-cutover"

function pushItem(items: GrowthOperatorAttentionItem[], item: GrowthOperatorAttentionItem | null): void {
  if (!item || item.count <= 0) return
  items.push(item)
}

export async function buildGrowthOperatorAttentionStrip(
  admin: SupabaseClient,
  userId: string,
): Promise<GrowthOperatorAttentionStrip> {
  const [attention, outbound] = await Promise.all([
    fetchGrowthAttentionDashboard(admin, userId).catch(() => null),
    fetchGrowthOutboundOperationsDashboard(admin).catch(() => null),
  ])

  const items: GrowthOperatorAttentionItem[] = []

  const outreachPending = outbound?.approvals.outreach_pending_approval ?? 0
  const sequencePending = outbound?.approvals.sequence_pending_approval ?? 0
  const adapterRollbackActive = isAdapterOutboundExecutionEnabled()
  const approvalTotal =
    (adapterRollbackActive ? outreachPending : 0) +
    sequencePending +
    (attention?.needsApprovalCount ?? 0)

  pushItem(items, {
    id: "outreach_approval",
    category: "approval",
    label: "Pending approvals",
    summary: adapterRollbackActive
      ? `${outreachPending} outreach · ${sequencePending} sequence`
      : `${sequencePending} sequence (native transport)`,
    count: approvalTotal,
    href: "/admin/growth/sequences/execution",
    severity: approvalTotal >= 5 ? "high" : "medium",
  })

  const recoveryCount = outbound?.recovery_queue.length ?? 0
  const failedQueue = (outbound?.outreach_queue.failed ?? 0) + (outbound?.outreach_queue.dead_letter ?? 0)
  const recoveryTotal = Math.max(recoveryCount, failedQueue)

  pushItem(items, {
    id: "outbound_recovery",
    category: "recovery",
    label: "Failed outbound",
    summary: "Replay-eligible queue items and dead letters",
    count: recoveryTotal,
    href: "/admin/growth/operations/outbound",
    severity: recoveryTotal >= 3 ? "high" : "medium",
  })

  const outageAlerts =
    outbound?.queue_health_alerts.filter((alert) => isOutboundOutageAlert(alert)).length ?? 0
  const stuck =
    (outbound?.outreach_queue.stuck_processing ?? 0) + (outbound?.outreach_queue.overdue_scheduled ?? 0)

  pushItem(items, {
    id: "queue_lag",
    category: "queue",
    label: "Queue attention",
    summary: `${outageAlerts} outage alert(s) · ${stuck} overdue/stuck`,
    count: outageAlerts + stuck,
    href: "/admin/growth/operations/outbound",
    severity: outageAlerts > 0 ? "high" : stuck > 0 ? "medium" : "low",
  })

  pushItem(items, {
    id: "deliverability_risk",
    category: "deliverability",
    label: "Deliverability blocks",
    summary: "Pre-send suppression and reputation blocks (24h)",
    count: outbound?.suppression.pre_send_blocks_24h ?? 0,
    href: "/admin/growth/deliverability",
    severity: (outbound?.suppression.pre_send_blocks_24h ?? 0) >= 3 ? "high" : "medium",
  })

  pushItem(items, {
    id: "provider_issues",
    category: "provider",
    label: "Provider issues",
    summary: "Auth failures, degraded connections, and webhooks",
    count:
      (attention?.providerIssueCount ?? 0) +
      (outbound?.transport.failed_attempts_24h ?? 0),
    href: "/admin/growth/providers/setup",
    severity: (attention?.providerIssueCount ?? 0) > 0 ? "critical" : "medium",
  })

  pushItem(items, {
    id: "critical_attention",
    category: "reply",
    label: "Critical notifications",
    summary: "Replies, cadence, and high-priority operator items",
    count: attention?.criticalCount ?? 0,
    href: "/admin/growth/command#cc-communication",
    severity: "critical",
  })

  items.sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 }
    return rank[a.severity] - rank[b.severity] || b.count - a.count
  })

  return {
    qa_marker: GROWTH_OPERATOR_UX_H3_QA_MARKER,
    generated_at: new Date().toISOString(),
    total_attention: items.reduce((sum, row) => sum + row.count, 0),
    items: items.slice(0, 8),
  }
}
