/** Client-safe operator copy + setup/operational mode for Send Infrastructure. */

import {
  growthInfrastructureReadinessOperatorLabel,
  sanitizeInfrastructureReadinessDetailForOperator,
} from "@/lib/growth/deliverability/dns-setup-operator-types"
import type {
  GrowthInfrastructureReadinessCatalogEntry,
  GrowthInfrastructureReadinessStatus,
} from "@/lib/growth/infrastructure/infrastructure-readiness-types"

export const GROWTH_SEND_INFRASTRUCTURE_OPERATOR_READY_QA_MARKER =
  "growth-send-infrastructure-operator-ready-v1" as const
export const GROWTH_SEND_INFRASTRUCTURE_SETUP_MODE_QA_MARKER =
  "growth-send-infrastructure-setup-mode-v1" as const
export const GROWTH_SEND_INFRASTRUCTURE_OPERATIONAL_MODE_QA_MARKER =
  "growth-send-infrastructure-operational-mode-v1" as const
export const GROWTH_SEND_INFRASTRUCTURE_RUNTIME_STABLE_V2_QA_MARKER =
  "growth-send-infrastructure-runtime-stable-v2" as const

export const GROWTH_SEND_INFRASTRUCTURE_CHECKLIST_STATUSES = [
  "ready",
  "needs_setup",
  "in_progress",
  "not_connected",
] as const

export type GrowthSendInfrastructureChecklistStatus = (typeof GROWTH_SEND_INFRASTRUCTURE_CHECKLIST_STATUSES)[number]

export type GrowthSendInfrastructureChecklistItem = {
  id: string
  label: string
  status: GrowthSendInfrastructureChecklistStatus
  detail: string
  href?: string
}

export const GROWTH_SEND_INFRASTRUCTURE_CHECKLIST_STATUS_LABELS: Record<
  GrowthSendInfrastructureChecklistStatus,
  string
> = {
  ready: "Ready",
  needs_setup: "Needs setup",
  in_progress: "In progress",
  not_connected: "Not connected",
}

export type SendInfrastructureDomainSnapshot = {
  domain: string
  spfStatus: "verified" | "missing" | "manual_required"
  dkimStatus: "verified" | "missing" | "manual_required"
  dmarcStatus: "verified" | "missing" | "manual_required"
  verificationLabel: string
  verificationError: string | null
  reputationWarnings: string[]
  readinessStatus: string
}

export type SendInfrastructureMailboxSnapshot = {
  providerFamily: string
  status: string
  connectionHealth: number
  dailySendLimit: number
  warmupStage: string
}

export type SendInfrastructureOperatorSnapshot = {
  liveDnsEnabled: boolean
  connectedMailboxes: number
  totalMailboxes: number
  mailboxes: SendInfrastructureMailboxSnapshot[]
  domainCount: number
  domains: SendInfrastructureDomainSnapshot[]
  senderPoolCount: number
  activePoolSenders: number
  warmupActiveCount: number
  googleOAuthConfigured: boolean
  sent24h: number
  failedSends24h: number
  pendingApprovals: number
  scheduledOutreach: number
  sequenceJobsDue: number
  unhealthyMailboxCount: number
  readinessCatalog: GrowthInfrastructureReadinessCatalogEntry[]
}

export type SendInfrastructureProviderCard = {
  id: "google" | "microsoft" | "smtp" | "custom"
  label: string
  connectionStatus: "connected" | "not_connected"
  healthLabel: "Healthy" | "Warning" | "Paused" | "Not connected"
  healthTone: "healthy" | "attention" | "critical" | "neutral"
  mailboxesAttached: number
  lastActivityLabel: string
  ctaLabel: string
  ctaHref: string
  detail: string
}

function readinessCatalogEntry(
  catalog: GrowthInfrastructureReadinessCatalogEntry[],
  surfaceId: GrowthInfrastructureReadinessCatalogEntry["surfaceId"],
  matchTitle?: string,
): GrowthInfrastructureReadinessCatalogEntry | null {
  return (
    catalog.find((item) => item.surfaceId === surfaceId && (!matchTitle || item.title === matchTitle)) ??
    catalog.find((item) => item.surfaceId === surfaceId) ??
    null
  )
}

function authChecklistStatus(domainCount: number, validCount: number): GrowthSendInfrastructureChecklistStatus {
  if (domainCount <= 0) return "not_connected"
  if (validCount >= domainCount) return "ready"
  if (validCount > 0) return "in_progress"
  return "needs_setup"
}

function mapReadinessToChecklistStatus(status: GrowthInfrastructureReadinessStatus): GrowthSendInfrastructureChecklistStatus {
  switch (status) {
    case "live":
      return "ready"
    case "disabled":
    case "error":
      return "not_connected"
    case "degraded":
    case "simulated":
    case "internal":
      return "in_progress"
    default:
      return "needs_setup"
  }
}

export function formatDomainVerificationLabel(label: string): string {
  const normalized = label.trim()
  if (normalized === "MANUAL VERIFICATION REQUIRED") return "DNS verification required"
  if (normalized === "MANUAL OVERRIDE") return "Manually attested"
  if (normalized === "LIVE VERIFIED") return "Live verified"
  if (normalized === "LIVE VERIFICATION FAILED") return "Live verification failed"
  if (normalized.startsWith("LIVE DNS ENABLED")) return "Live DNS enabled — awaiting verification"
  return normalized.replace(/MANUAL VERIFICATION REQUIRED/gi, "DNS verification required")
}

export function formatDnsRecordOperatorLabel(
  status: SendInfrastructureDomainSnapshot["spfStatus"],
  record: "SPF" | "DKIM" | "DMARC" | "MX",
): string {
  switch (status) {
    case "verified":
      return `${record} verified`
    case "manual_required":
      return `${record} verification required`
    default:
      return `${record} record missing`
  }
}

export function formatDomainReadinessOperatorLabel(status: string): string {
  switch (status) {
    case "live":
      return "Ready"
    case "stub":
      return "Setup required"
    case "internal":
      return "Internal data only"
    case "disabled":
      return "Not connected"
    case "degraded":
    case "error":
      return "Verification required"
    default:
      return growthInfrastructureReadinessOperatorLabel(status as GrowthInfrastructureReadinessStatus)
  }
}

export function buildSendInfrastructureChecklist(
  input: SendInfrastructureOperatorSnapshot,
): GrowthSendInfrastructureChecklistItem[] {
  const spfReady = input.domains.filter((d) => d.spfStatus === "verified").length
  const dkimReady = input.domains.filter((d) => d.dkimStatus === "verified").length
  const dmarcReady = input.domains.filter((d) => d.dmarcStatus === "verified").length
  const capsConfigured = input.mailboxes.some((m) => m.dailySendLimit > 0)
  const mailboxEntry = readinessCatalogEntry(input.readinessCatalog, "mailbox_provider", "Google mailbox (primary)")
  const warmupEntry = readinessCatalogEntry(input.readinessCatalog, "warmup")

  const mailboxStatus: GrowthSendInfrastructureChecklistStatus =
    input.connectedMailboxes > 0
      ? "ready"
      : input.totalMailboxes > 0
        ? "in_progress"
        : mailboxEntry
          ? mapReadinessToChecklistStatus(mailboxEntry.readiness.status)
          : "needs_setup"

  const warmupStatus: GrowthSendInfrastructureChecklistStatus =
    input.warmupActiveCount > 0
      ? "ready"
      : input.mailboxes.some((m) => m.warmupStage === "eligible")
        ? "in_progress"
        : warmupEntry?.readiness.status === "disabled"
          ? "not_connected"
          : "needs_setup"

  const poolStatus: GrowthSendInfrastructureChecklistStatus =
    input.senderPoolCount <= 0
      ? "needs_setup"
      : input.activePoolSenders > 0
        ? "ready"
        : "in_progress"

  const sequenceStatus: GrowthSendInfrastructureChecklistStatus =
    input.sent24h > 0
      ? "ready"
      : input.scheduledOutreach > 0 || input.sequenceJobsDue > 0
        ? "in_progress"
        : input.connectedMailboxes > 0 && input.domainCount > 0
          ? "needs_setup"
          : "not_connected"

  return [
    {
      id: "mailbox_provider",
      label: "Connect mailbox provider",
      status: mailboxStatus,
      detail:
        input.connectedMailboxes > 0
          ? `${input.connectedMailboxes} mailbox${input.connectedMailboxes === 1 ? "" : "es"} connected.`
          : input.totalMailboxes > 0
            ? "Mailbox connections exist but none are fully connected yet."
            : "No mailbox providers connected yet.",
      href: "/growth/settings/communications/mailboxes",
    },
    {
      id: "sending_domain",
      label: "Add sending domain",
      status: input.domainCount > 0 ? "ready" : "needs_setup",
      detail:
        input.domainCount > 0
          ? `${input.domainCount} sending domain${input.domainCount === 1 ? "" : "s"} configured.`
          : "No sender domains configured yet.",
      href: "/admin/growth/infrastructure",
    },
    {
      id: "spf",
      label: "Verify SPF",
      status: authChecklistStatus(input.domainCount, spfReady),
      detail:
        input.domainCount <= 0
          ? "Add a sending domain before verifying SPF."
          : spfReady >= input.domainCount
            ? "SPF verified on all sending domains."
            : "SPF record missing or still needs verification on one or more domains.",
      href: "/admin/growth/infrastructure/deliverability",
    },
    {
      id: "dkim",
      label: "Verify DKIM",
      status: authChecklistStatus(input.domainCount, dkimReady),
      detail:
        input.domainCount <= 0
          ? "Add a sending domain before verifying DKIM."
          : dkimReady >= input.domainCount
            ? "DKIM configured on all sending domains."
            : "DKIM is not configured on one or more domains.",
      href: "/admin/growth/infrastructure/deliverability",
    },
    {
      id: "dmarc",
      label: "Verify DMARC",
      status: authChecklistStatus(input.domainCount, dmarcReady),
      detail:
        input.domainCount <= 0
          ? "Add a sending domain before verifying DMARC."
          : dmarcReady >= input.domainCount
            ? "DMARC policy detected on all sending domains."
            : "DMARC policy not detected on one or more domains.",
      href: "/admin/growth/infrastructure/deliverability",
    },
    {
      id: "sender_pool",
      label: "Configure sender pool",
      status: poolStatus,
      detail:
        input.senderPoolCount <= 0
          ? "No sender pools configured yet."
          : input.activePoolSenders > 0
            ? `${input.activePoolSenders} active sender${input.activePoolSenders === 1 ? "" : "s"} in pools.`
            : "Sender pools exist but no active senders are assigned yet.",
      href: "/admin/growth/infrastructure",
    },
    {
      id: "warmup",
      label: "Start warmup",
      status: warmupStatus,
      detail:
        input.warmupActiveCount > 0
          ? `${input.warmupActiveCount} mailbox${input.warmupActiveCount === 1 ? "" : "es"} in warmup.`
          : sanitizeInfrastructureReadinessDetailForOperator(warmupEntry?.readiness.detail) ??
            "Warmup has not started yet.",
      href: "/admin/growth/infrastructure/warmup",
    },
    {
      id: "sending_caps",
      label: "Configure sending caps",
      status: capsConfigured ? "ready" : input.totalMailboxes > 0 ? "needs_setup" : "not_connected",
      detail: capsConfigured
        ? "Daily send limits are configured for connected mailboxes."
        : input.totalMailboxes > 0
          ? "Set daily send limits before scaling outbound volume."
          : "Connect mailboxes before configuring send caps.",
      href: "/growth/settings/communications/mailboxes",
    },
    {
      id: "live_dns",
      label: "Enable live DNS verification",
      status: input.liveDnsEnabled ? "ready" : input.domainCount > 0 ? "needs_setup" : "not_connected",
      detail: input.liveDnsEnabled
        ? "Live DNS verification is enabled."
        : "Live DNS verification is not enabled yet.",
      href: "/admin/growth/infrastructure/deliverability",
    },
    {
      id: "first_sequence",
      label: "Run first outbound sequence",
      status: sequenceStatus,
      detail:
        input.sent24h > 0
          ? `${input.sent24h} send${input.sent24h === 1 ? "" : "s"} recorded in the last 24 hours.`
          : input.scheduledOutreach > 0 || input.sequenceJobsDue > 0
            ? "Outbound work is queued — complete setup and approvals to send."
            : "No outbound sequences have run yet.",
      href: "/admin/growth/operations/outbound",
    },
  ]
}

export function buildSendInfrastructureOperatorSummary(input: {
  checklist: GrowthSendInfrastructureChecklistItem[]
  snapshot: SendInfrastructureOperatorSnapshot
}): {
  headline: string
  connected: string[]
  needsSetup: string[]
  blockers: string[]
  nextSteps: string[]
} {
  const connected = input.checklist.filter((item) => item.status === "ready").map((item) => item.label)
  const needsSetup = input.checklist
    .filter((item) => item.status === "needs_setup" || item.status === "in_progress")
    .map((item) => item.label)

  const blockers: string[] = []
  if (input.snapshot.connectedMailboxes === 0) blockers.push("No mailbox providers connected yet.")
  if (input.snapshot.domainCount === 0) blockers.push("No sender domains configured.")
  if (!input.snapshot.liveDnsEnabled && input.snapshot.domainCount > 0) {
    blockers.push("Live DNS verification is not enabled yet.")
  }
  if (input.snapshot.senderPoolCount === 0 && input.snapshot.connectedMailboxes > 0) {
    blockers.push("Sender pool is not configured.")
  }
  if (input.snapshot.pendingApprovals > 0) {
    blockers.push(`${input.snapshot.pendingApprovals} outreach item${input.snapshot.pendingApprovals === 1 ? "" : "s"} waiting for approval.`)
  }

  const headline =
    input.snapshot.connectedMailboxes > 0 && input.snapshot.sent24h > 0
      ? "Outbound infrastructure is active — monitor health, caps, and deliverability below."
      : input.snapshot.connectedMailboxes > 0 || input.snapshot.domainCount > 0
        ? "Finish outbound setup to unlock live sending and operational telemetry."
        : "Start outbound setup by connecting a mailbox provider and adding a sending domain."

  return {
    headline,
    connected,
    needsSetup,
    blockers,
    nextSteps: input.checklist.filter((item) => item.status === "needs_setup").map((item) => item.label),
  }
}

export function hasMeaningfulOutboundOperationalMetrics(snapshot: SendInfrastructureOperatorSnapshot): boolean {
  return (
    snapshot.sent24h > 0 ||
    snapshot.failedSends24h > 0 ||
    snapshot.pendingApprovals > 0 ||
    (snapshot.connectedMailboxes > 0 &&
      (snapshot.activePoolSenders > 0 || snapshot.warmupActiveCount > 0 || snapshot.unhealthyMailboxCount > 0))
  )
}

export type SendInfrastructureOperatorSnapshotWithHealth = SendInfrastructureOperatorSnapshot

export function isSendInfrastructureSetupMode(snapshot: SendInfrastructureOperatorSnapshot): boolean {
  if (
    snapshot.connectedMailboxes === 0 &&
    snapshot.domainCount === 0 &&
    snapshot.senderPoolCount === 0 &&
    snapshot.sent24h === 0
  ) {
    return true
  }
  return !hasMeaningfulOutboundOperationalMetrics(snapshot)
}

export function buildSendInfrastructureProviderCards(
  snapshot: SendInfrastructureOperatorSnapshot,
): SendInfrastructureProviderCard[] {
  const googleMailboxes = snapshot.mailboxes.filter((m) => m.providerFamily === "google")
  const microsoftMailboxes = snapshot.mailboxes.filter((m) => m.providerFamily === "microsoft")
  const smtpMailboxes = snapshot.mailboxes.filter((m) => m.providerFamily === "smtp")
  const customMailboxes = snapshot.mailboxes.filter((m) => m.providerFamily === "custom")

  function providerHealth(
    mailboxes: SendInfrastructureMailboxSnapshot[],
  ): Pick<SendInfrastructureProviderCard, "healthLabel" | "healthTone" | "connectionStatus"> {
    const connected = mailboxes.filter((m) => m.status === "connected").length
    if (mailboxes.length === 0) {
      return { connectionStatus: "not_connected", healthLabel: "Not connected", healthTone: "neutral" }
    }
    if (connected === 0) {
      return { connectionStatus: "not_connected", healthLabel: "Warning", healthTone: "attention" }
    }
    if (mailboxes.some((m) => ["error", "expired", "critical", "paused"].includes(m.status))) {
      return { connectionStatus: "connected", healthLabel: "Paused", healthTone: "attention" }
    }
    if (mailboxes.some((m) => m.connectionHealth < 60)) {
      return { connectionStatus: "connected", healthLabel: "Warning", healthTone: "attention" }
    }
    return { connectionStatus: "connected", healthLabel: "Healthy", healthTone: "healthy" }
  }

  const microsoftEntry = readinessCatalogEntry(snapshot.readinessCatalog, "mailbox_provider", "Microsoft mailbox")

  return [
    {
      id: "google",
      label: "Google Workspace",
      ...providerHealth(googleMailboxes),
      mailboxesAttached: googleMailboxes.length,
      lastActivityLabel: snapshot.googleOAuthConfigured ? "OAuth configured" : "OAuth not configured",
      ctaLabel: snapshot.googleOAuthConfigured ? "Configure" : "Connect",
      ctaHref: "/growth/settings/communications/mailboxes",
      detail: snapshot.googleOAuthConfigured
        ? "Google Workspace send path is configured."
        : "Connect Google Workspace to send and sync replies.",
    },
    {
      id: "microsoft",
      label: "Microsoft 365",
      ...providerHealth(microsoftMailboxes),
      mailboxesAttached: microsoftMailboxes.length,
      lastActivityLabel:
        sanitizeInfrastructureReadinessDetailForOperator(microsoftEntry?.readiness.detail) ??
        "Microsoft 365 connection not configured.",
      ctaLabel: microsoftMailboxes.length > 0 ? "Configure" : "Connect",
      ctaHref: "/growth/settings/communications/mailboxes",
      detail: "Microsoft 365 mailbox integration for outbound and inbox sync.",
    },
    {
      id: "smtp",
      label: "SMTP/IMAP",
      ...providerHealth(smtpMailboxes),
      mailboxesAttached: smtpMailboxes.length,
      lastActivityLabel:
        smtpMailboxes.length > 0 ? `${smtpMailboxes.length} SMTP mailbox(es)` : "No SMTP mailboxes connected",
      ctaLabel: smtpMailboxes.length > 0 ? "Review issues" : "Connect",
      ctaHref: "/growth/settings/communications/mailboxes",
      detail: "SMTP/IMAP mailboxes for operator testing and alternate send paths.",
    },
    {
      id: "custom",
      label: "Custom provider",
      ...providerHealth(customMailboxes),
      mailboxesAttached: customMailboxes.length,
      lastActivityLabel: customMailboxes.length > 0 ? "Custom mailboxes attached" : "Not connected",
      ctaLabel: customMailboxes.length > 0 ? "Configure" : "Connect",
      ctaHref: "/growth/settings/communications/mailboxes",
      detail: "Custom provider connections for specialized mailbox setups.",
    },
  ]
}

export function buildDomainOperatorGuidance(domain: SendInfrastructureDomainSnapshot): string[] {
  const guidance: string[] = []
  if (domain.spfStatus !== "verified") guidance.push(formatDnsRecordOperatorLabel(domain.spfStatus, "SPF"))
  if (domain.dkimStatus !== "verified") guidance.push(formatDnsRecordOperatorLabel(domain.dkimStatus, "DKIM"))
  if (domain.dmarcStatus !== "verified") guidance.push(formatDnsRecordOperatorLabel(domain.dmarcStatus, "DMARC"))
  if (formatDomainVerificationLabel(domain.verificationLabel) === "DNS verification required") {
    guidance.push("DNS verification still needs to be completed.")
  }
  if (domain.verificationError) guidance.push(domain.verificationError)
  guidance.push(...domain.reputationWarnings)
  return guidance
}

export function snapshotFromInternalOutboundDashboard(dashboard: {
  mailboxes: Array<{
    providerFamily: string
    status: string
    connectionHealth: number
    dailySendLimit: number
    warmupStage: string
  }>
  domains: SendInfrastructureDomainSnapshot[]
  sender_pools: Array<{ activeSenders: number }>
  deliverability: { sent24h: number; failedSends24h: number; unhealthyMailboxCount: number }
  deliverability_intelligence: { live_dns_enabled: boolean }
  queue_health: {
    approvals: { outreach_pending_approval: number }
    outreach_queue: { scheduled: number }
    sequence_jobs: { approved_due: number }
  }
  google_provider: { oauthConfigured: boolean }
  readiness_catalog: GrowthInfrastructureReadinessCatalogEntry[]
}): SendInfrastructureOperatorSnapshot {
  return {
    liveDnsEnabled: dashboard.deliverability_intelligence.live_dns_enabled,
    connectedMailboxes: dashboard.mailboxes.filter((m) => m.status === "connected").length,
    totalMailboxes: dashboard.mailboxes.length,
    mailboxes: dashboard.mailboxes.map((m) => ({
      providerFamily: m.providerFamily,
      status: m.status,
      connectionHealth: m.connectionHealth,
      dailySendLimit: m.dailySendLimit,
      warmupStage: m.warmupStage,
    })),
    domainCount: dashboard.domains.length,
    domains: dashboard.domains,
    senderPoolCount: dashboard.sender_pools.length,
    activePoolSenders: dashboard.sender_pools.reduce((sum, pool) => sum + pool.activeSenders, 0),
    warmupActiveCount: dashboard.mailboxes.filter((m) => m.warmupStage === "warming").length,
    googleOAuthConfigured: dashboard.google_provider.oauthConfigured,
    sent24h: dashboard.deliverability.sent24h,
    failedSends24h: dashboard.deliverability.failedSends24h,
    pendingApprovals: dashboard.queue_health.approvals.outreach_pending_approval,
    scheduledOutreach: dashboard.queue_health.outreach_queue.scheduled,
    sequenceJobsDue: dashboard.queue_health.sequence_jobs.approved_due,
    unhealthyMailboxCount: dashboard.deliverability.unhealthyMailboxCount,
    readinessCatalog: dashboard.readiness_catalog,
  }
}
