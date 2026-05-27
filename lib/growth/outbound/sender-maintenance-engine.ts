import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthMaintenanceTaskRow } from "@/lib/growth/outbound/lifecycle-ops-types"
import { listInboxLifecycleRows } from "@/lib/growth/outbound/inbox-lifecycle-engine"
import { computeDomainOperationalHealth } from "@/lib/growth/deliverability/domain-health-engine"
import { listSenderDomains } from "@/lib/growth/sender/sender-repository"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import { listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"

function tasksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("maintenance_tasks")
}

export async function createMaintenanceTask(
  admin: SupabaseClient,
  input: {
    taskType: string
    severity?: "low" | "medium" | "high" | "critical"
    title: string
    summary?: string | null
    senderAccountId?: string | null
    mailboxConnectionId?: string | null
    senderDomainId?: string | null
    senderPoolId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const dedupeKey = `${input.taskType}:${input.senderAccountId ?? input.senderDomainId ?? input.title}`
  const { data: existing } = await tasksTable(admin)
    .select("id")
    .eq("status", "open")
    .eq("task_type", input.taskType)
    .eq("title", input.title)
    .limit(1)
    .maybeSingle()

  if (existing) return

  await tasksTable(admin).insert({
    task_type: input.taskType,
    severity: input.severity ?? "medium",
    title: input.title,
    summary: input.summary ?? null,
    sender_account_id: input.senderAccountId ?? null,
    mailbox_connection_id: input.mailboxConnectionId ?? null,
    sender_domain_id: input.senderDomainId ?? null,
    sender_pool_id: input.senderPoolId ?? null,
    recommendation_only: true,
    metadata: { dedupe_key: dedupeKey, ...(input.metadata ?? {}) },
  })
}

export async function runSenderMaintenanceScan(admin: SupabaseClient): Promise<{ tasksCreated: number }> {
  let tasksCreated = 0
  const lifecycleRows = await listInboxLifecycleRows(admin)

  for (const row of lifecycleRows) {
    if (row.inactivityDays != null && row.inactivityDays >= 14) {
      await createMaintenanceTask(admin, {
        taskType: "inactive_sender",
        severity: "medium",
        title: `Inactive sender: ${row.emailAddress}`,
        summary: `No sends in ${row.inactivityDays} days — verify mailbox health.`,
        senderAccountId: row.senderAccountId,
        mailboxConnectionId: row.mailboxConnectionId,
      })
      tasksCreated += 1
    }

    if (row.fatigueScore >= 70) {
      await createMaintenanceTask(admin, {
        taskType: "cooldown_recommended",
        severity: "high",
        title: `Cooldown recommended: ${row.emailAddress}`,
        summary: `Fatigue score ${row.fatigueScore} — reduce send volume.`,
        senderAccountId: row.senderAccountId,
        mailboxConnectionId: row.mailboxConnectionId,
      })
      tasksCreated += 1
    }

    if (row.lifecycleStage === "elevated_risk") {
      await createMaintenanceTask(admin, {
        taskType: "unhealthy_sender_isolation",
        severity: "high",
        title: `Isolate unhealthy sender: ${row.emailAddress}`,
        summary: "Elevated risk stage — consider pausing in pool rotation.",
        senderAccountId: row.senderAccountId,
      })
      tasksCreated += 1
    }

    if (row.retirementCandidate) {
      await createMaintenanceTask(admin, {
        taskType: "retirement_candidate",
        severity: "medium",
        title: `Retirement review: ${row.emailAddress}`,
        summary: "Operator retirement review recommended — no auto-retire.",
        senderAccountId: row.senderAccountId,
      })
      tasksCreated += 1
    }
  }

  const mailboxes = await listMailboxConnections(admin)
  for (const mailbox of mailboxes) {
    if (mailbox.token_expires_at) {
      const hoursLeft = (Date.parse(mailbox.token_expires_at) - Date.now()) / 3600000
      if (hoursLeft <= 48 && hoursLeft > 0) {
        await createMaintenanceTask(admin, {
          taskType: "oauth_refresh_warning",
          severity: hoursLeft <= 12 ? "critical" : "high",
          title: `OAuth token expiring: ${mailbox.email_address}`,
          summary: `Token expires in ~${Math.round(hoursLeft)}h — refresh OAuth.`,
          mailboxConnectionId: mailbox.id,
          senderAccountId: mailbox.sender_account_id,
        })
        tasksCreated += 1
      }
    }
  }

  if (!googleProviderOAuthConfigured()) {
    await createMaintenanceTask(admin, {
      taskType: "oauth_refresh_warning",
      severity: "high",
      title: "Google OAuth not configured",
      summary: "Live mailbox path unavailable — complete OAuth setup.",
    })
    tasksCreated += 1
  }

  const domains = await listSenderDomains(admin)
  for (const domain of domains) {
    const health = await computeDomainOperationalHealth(admin, domain.id)
    if (health.signals.bounceRate >= 5) {
      await createMaintenanceTask(admin, {
        taskType: "send_reduction",
        severity: "high",
        title: `Reduce volume on ${domain.domain}`,
        summary: `Bounce rate ${health.signals.bounceRate}% — recommend send reduction.`,
        senderDomainId: domain.id,
      })
      tasksCreated += 1
    }
  }

  return { tasksCreated }
}

export async function listOpenMaintenanceTasks(admin: SupabaseClient, limit = 40): Promise<GrowthMaintenanceTaskRow[]> {
  const { data, error } = await tasksTable(admin)
    .select("id, task_type, severity, title, summary, status, recommendation_only, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return []

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    taskType: String(row.task_type),
    severity: String(row.severity),
    title: String(row.title),
    summary: row.summary ? String(row.summary) : null,
    status: String(row.status),
    recommendationOnly: Boolean(row.recommendation_only),
    createdAt: String(row.created_at),
  }))
}
