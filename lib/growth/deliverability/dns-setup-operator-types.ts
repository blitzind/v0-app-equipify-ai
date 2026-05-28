/** Client-safe operator copy + checklist for DNS & Setup (infrastructure deliverability). */

import type { GrowthDeliverabilityDashboard, GrowthDeliverabilityDomainRow } from "@/lib/growth/deliverability/deliverability-types"
import type {
  GrowthInfrastructureReadinessCatalogEntry,
  GrowthInfrastructureReadinessDescriptor,
  GrowthInfrastructureReadinessStatus,
} from "@/lib/growth/infrastructure/infrastructure-readiness-types"

export const GROWTH_DNS_SETUP_OPERATOR_READY_QA_MARKER = "growth-dns-setup-operator-ready-v1" as const

export const GROWTH_DNS_SETUP_CHECKLIST_ITEM_STATUSES = [
  "ready",
  "needs_setup",
  "not_connected",
  "internal_only",
] as const

export type GrowthDnsSetupChecklistItemStatus = (typeof GROWTH_DNS_SETUP_CHECKLIST_ITEM_STATUSES)[number]

export type GrowthDnsSetupChecklistItem = {
  id: string
  label: string
  status: GrowthDnsSetupChecklistItemStatus
  detail: string
  href?: string
}

export const GROWTH_INFRASTRUCTURE_READINESS_OPERATOR_LABELS: Record<GrowthInfrastructureReadinessStatus, string> = {
  live: "Ready",
  stub: "Setup required",
  simulated: "Simulated",
  preview_only: "Preview only",
  disabled: "Not connected",
  internal: "Internal data only",
  error: "Error",
  degraded: "Degraded",
}

export const GROWTH_DNS_SETUP_CHECKLIST_STATUS_LABELS: Record<GrowthDnsSetupChecklistItemStatus, string> = {
  ready: "Ready",
  needs_setup: "Needs setup",
  not_connected: "Not connected",
  internal_only: "Internal only",
}

export function growthInfrastructureReadinessOperatorLabel(
  status: GrowthInfrastructureReadinessStatus,
): string {
  return GROWTH_INFRASTRUCTURE_READINESS_OPERATOR_LABELS[status]
}

const ENV_VAR_PATTERN = /\bGROWTH_[A-Z0-9_]+\s*=\s*true\b/gi

export function sanitizeInfrastructureReadinessDetailForOperator(
  detail: string | undefined,
): string | undefined {
  if (!detail?.trim()) return undefined

  const normalized = detail.trim()
  if (/GROWTH_LIVE_DNS_VERIFICATION/i.test(normalized) && /MANUAL VERIFICATION REQUIRED/i.test(normalized)) {
    return "Live DNS checks are not enabled yet."
  }
  if (/GROWTH_LIVE_DNS_VERIFICATION/i.test(normalized) && /LIVE VERIFIED|scheduled cron probes/i.test(normalized)) {
    return "Live DNS checks are enabled and run on a schedule."
  }
  if (/GROWTH_LIVE_DNS_VERIFICATION/i.test(normalized)) {
    return normalized.replace(ENV_VAR_PATTERN, "live DNS checks").replace(/\s{2,}/g, " ").trim()
  }

  return normalized.replace(ENV_VAR_PATTERN, "required platform configuration").replace(/\s{2,}/g, " ").trim()
}

export function formatInfrastructureReadinessForOperator(
  readiness: GrowthInfrastructureReadinessDescriptor,
): GrowthInfrastructureReadinessDescriptor {
  return {
    status: readiness.status,
    label: growthInfrastructureReadinessOperatorLabel(readiness.status),
    detail: sanitizeInfrastructureReadinessDetailForOperator(readiness.detail),
  }
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

function mapReadinessToChecklistStatus(status: GrowthInfrastructureReadinessStatus): GrowthDnsSetupChecklistItemStatus {
  switch (status) {
    case "live":
      return "ready"
    case "internal":
    case "simulated":
      return "internal_only"
    case "disabled":
    case "error":
      return "not_connected"
    default:
      return "needs_setup"
  }
}

function authRecordChecklistStatus(domainCount: number, validCount: number): GrowthDnsSetupChecklistItemStatus {
  if (domainCount <= 0) return "not_connected"
  if (validCount >= domainCount) return "ready"
  return "needs_setup"
}

function authRecordDetail(label: string, domainCount: number, validCount: number): string {
  if (domainCount <= 0) return `Add a sending domain before you can verify ${label}.`
  if (validCount >= domainCount) return `${label} passes on all ${domainCount} sending domain${domainCount === 1 ? "" : "s"}.`
  if (validCount <= 0) return `${label} is not verified on any sending domain yet.`
  return `${label} verified on ${validCount} of ${domainCount} sending domain${domainCount === 1 ? "" : "s"}.`
}

export type BuildDnsSetupChecklistInput = {
  domains: GrowthDeliverabilityDomainRow[]
  liveDnsEnabled: boolean
  readinessCatalog: GrowthInfrastructureReadinessCatalogEntry[]
}

export function buildDnsSetupChecklist(input: BuildDnsSetupChecklistInput): GrowthDnsSetupChecklistItem[] {
  const domainCount = input.domains.length
  const spfValidCount = input.domains.filter((row) => row.spf_present && row.spf_valid).length
  const dkimValidCount = input.domains.filter((row) => row.dkim_present && row.dkim_valid).length
  const dmarcValidCount = input.domains.filter((row) => row.dmarc_present && row.dmarc_valid).length

  const mailboxEntry = readinessCatalogEntry(input.readinessCatalog, "mailbox_provider", "Google mailbox (primary)")
  const mailboxReadiness = mailboxEntry?.readiness
  const warmupEntry = readinessCatalogEntry(input.readinessCatalog, "warmup")
  const warmupReadiness = warmupEntry?.readiness

  return [
    {
      id: "mailbox_provider",
      label: "Connect mailbox provider",
      status: mailboxReadiness ? mapReadinessToChecklistStatus(mailboxReadiness.status) : "not_connected",
      detail:
        sanitizeInfrastructureReadinessDetailForOperator(mailboxReadiness?.detail) ??
        "Connect Google Workspace or another mailbox provider to send and sync replies.",
      href: "/admin/growth/infrastructure/mailboxes",
    },
    {
      id: "sending_domain",
      label: "Add sending domain",
      status: domainCount > 0 ? "ready" : "needs_setup",
      detail:
        domainCount > 0
          ? `${domainCount} sending domain${domainCount === 1 ? "" : "s"} registered for DNS checks.`
          : "Register at least one sender domain in Infrastructure.",
      href: "/admin/growth/infrastructure",
    },
    {
      id: "spf",
      label: "Verify SPF",
      status: authRecordChecklistStatus(domainCount, spfValidCount),
      detail: authRecordDetail("SPF", domainCount, spfValidCount),
    },
    {
      id: "dkim",
      label: "Verify DKIM",
      status: authRecordChecklistStatus(domainCount, dkimValidCount),
      detail: authRecordDetail("DKIM", domainCount, dkimValidCount),
    },
    {
      id: "dmarc",
      label: "Verify DMARC",
      status: authRecordChecklistStatus(domainCount, dmarcValidCount),
      detail: authRecordDetail("DMARC", domainCount, dmarcValidCount),
    },
    {
      id: "live_dns",
      label: "Enable live DNS checks",
      status: input.liveDnsEnabled ? "ready" : "needs_setup",
      detail: input.liveDnsEnabled
        ? "Live DNS verification is connected for scheduled SPF, DKIM, DMARC, and MX probes."
        : "Live DNS checks are not enabled yet.",
    },
    {
      id: "warmup",
      label: "Start warmup tracking",
      status: warmupReadiness ? mapReadinessToChecklistStatus(warmupReadiness.status) : "not_connected",
      detail:
        sanitizeInfrastructureReadinessDetailForOperator(warmupReadiness?.detail) ??
        "Warmup planning is available; automated warmup execution is not connected yet.",
      href: "/admin/growth/infrastructure/warmup",
    },
  ]
}

export function buildDnsSetupOperatorSummary(input: {
  checklist: GrowthDnsSetupChecklistItem[]
  liveDnsEnabled: boolean
  domainCount: number
}): {
  headline: string
  workingToday: string[]
  notConnectedYet: string[]
  nextSteps: string[]
} {
  const workingToday = input.checklist
    .filter((item) => item.status === "ready")
    .map((item) => `${item.label} — ${item.detail}`)
  const internalOnly = input.checklist
    .filter((item) => item.status === "internal_only")
    .map((item) => `${item.label} — ${item.detail}`)
  const notConnectedYet = input.checklist
    .filter((item) => item.status === "not_connected")
    .map((item) => `${item.label} — ${item.detail}`)
  const nextSteps = input.checklist
    .filter((item) => item.status === "needs_setup")
    .map((item) => item.label)

  const headline = input.liveDnsEnabled
    ? "DNS setup is connected — review authentication coverage and warmup progress below."
    : input.domainCount > 0
      ? "DNS setup preview — stored domain records are visible, but live DNS verification and mailbox placement checks are not connected yet."
      : "DNS setup preview — Live DNS verification and mailbox placement checks are not connected yet."

  return {
    headline,
    workingToday: [...workingToday, ...internalOnly],
    notConnectedYet,
    nextSteps,
  }
}

export function hasMeaningfulDnsDashboardMetrics(input: {
  domainCount: number
  liveDnsEnabled: boolean
  dashboard: GrowthDeliverabilityDashboard | null
  domains: GrowthDeliverabilityDomainRow[]
}): boolean {
  if (input.domainCount <= 0) return false

  const hasCheckedDomains = input.domains.some((row) => Boolean(row.last_checked_at))
  const tierTotal =
    (input.dashboard?.healthy_count ?? 0) +
    (input.dashboard?.warning_count ?? 0) +
    (input.dashboard?.critical_count ?? 0)
  const hasCoverage =
    (input.dashboard?.spf_coverage_percent ?? 0) > 0 ||
    (input.dashboard?.dkim_coverage_percent ?? 0) > 0 ||
    (input.dashboard?.dmarc_coverage_percent ?? 0) > 0 ||
    (input.dashboard?.mx_coverage_percent ?? 0) > 0

  if (input.liveDnsEnabled) return true
  return hasCheckedDomains || tierTotal > 0 || hasCoverage || (input.dashboard?.average_score ?? 0) > 0
}
