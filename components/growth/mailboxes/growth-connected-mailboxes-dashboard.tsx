"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Loader2, Plug, RefreshCw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import {
  GROWTH_CONNECTED_MAILBOXES_QA_MARKER,
  type GrowthConnectedMailboxFilter,
  type GrowthConnectedMailboxRow,
  type GrowthConnectedMailboxesDashboardPayload,
} from "@/lib/growth/mailboxes/connected-mailboxes-dashboard-types"
import {
  GROWTH_ADMIN_BASE_PATH,
  isGrowthWorkspacePathname,
} from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  GROWTH_WORKSPACE_DNS_VERIFICATION_PATH,
  GROWTH_WORKSPACE_MAILBOXES_PATH,
  GROWTH_WORKSPACE_REPUTATION_PATH,
  GROWTH_WORKSPACE_SENDER_POOLS_PATH,
  GROWTH_WORKSPACE_SENDER_SETUP_PATH,
  GROWTH_WORKSPACE_WARMUP_PATH,
} from "@/lib/growth/navigation/growth-delivery-settings-navigation"
import { growthEngineCustomerSettingsHref } from "@/lib/growth/navigation/growth-workspace-settings-canonical"
import {
  GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH,
  GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
  growthCommunicationsWarmupHref,
  isGrowthCommunicationsSettingsPath,
} from "@/lib/growth/navigation/growth-communications-settings-navigation"
import { resolveConnectedMailboxWarmupDisplay } from "@/lib/growth/mailboxes/connected-mailbox-warmup-label"
import type { GrowthMailboxConnectionSummary } from "@/lib/growth/mailboxes/mailbox-types"
import type { GrowthMailboxCanonicalHealthState } from "@/lib/growth/mailboxes/mailbox-canonical-health"
import { resolveMailboxCardHealthDisplay } from "@/lib/growth/mailboxes/mailbox-canonical-health"
import { cn } from "@/lib/utils"

type MailboxValidationFeedback = {
  ok: boolean
  message: string
  status: string
  healthTier: string
  healthReason: string | null
  lastValidationAt: string | null
  suggestedNextStep: string | null
}

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked" | "medium"> = {
  connected: "healthy",
  healthy: "healthy",
  warning: "attention",
  degraded: "attention",
  expired: "attention",
  critical: "critical",
  error: "critical",
  pending: "neutral",
  connecting: "neutral",
  disabled: "blocked",
  no_mailbox: "attention",
  warming: "medium",
  active: "healthy",
  paused: "attention",
  throttled: "attention",
  eligible: "healthy",
  blocked: "blocked",
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function isHealthyRow(row: GrowthConnectedMailboxRow): boolean {
  return row.canonicalHealthState === "healthy"
}

function isWarmingRow(row: GrowthConnectedMailboxRow): boolean {
  if (row.warmupStatus === "warming" || row.warmupStatus === "new") return true
  return row.senderStatus === "connected" && row.warmupStatus != null && row.warmupStatus !== "active"
}

function isPausedRow(row: GrowthConnectedMailboxRow): boolean {
  return (
    row.senderStatus === "disabled" ||
    row.operationalPaused ||
    row.warmupStatus === "paused" ||
    row.warmupStatus === "disabled" ||
    row.warmupStatus === "throttled"
  )
}

function isUnhealthyRow(row: GrowthConnectedMailboxRow): boolean {
  return !isHealthyRow(row)
}

function canonicalHealthTone(state: GrowthMailboxCanonicalHealthState): "healthy" | "attention" | "critical" | "neutral" {
  if (state === "healthy") return "healthy"
  if (state === "warning") return "attention"
  if (state === "unhealthy") return "critical"
  return "neutral"
}

function mailboxHealthAccent(row: GrowthConnectedMailboxRow): string {
  const { state } = resolveMailboxCardHealthDisplay(row)
  if (state === "healthy") {
    return "border-emerald-200/90 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20"
  }
  if (state === "unhealthy" || state === "disconnected") {
    return "border-rose-200/90 bg-rose-50/20 dark:border-rose-900/50 dark:bg-rose-950/20"
  }
  return "border-amber-200/90 bg-amber-50/20 dark:border-amber-900/50 dark:bg-amber-950/20"
}

function providerLabel(family: string): string {
  if (family === "google") return "Google"
  if (family === "microsoft") return "Microsoft"
  return family
}

function validationSuggestedNextStep(
  row: GrowthConnectedMailboxRow,
  mailbox: GrowthMailboxConnectionSummary,
): string | null {
  if (row.needsReconnect || !mailbox.token_configured) {
    return "Reconnect Gmail to refresh OAuth tokens."
  }
  if (mailbox.status === "expired") {
    return "Token expired — reconnect Gmail, then validate again."
  }
  if (mailbox.status === "error") {
    return "Review OAuth connection and provider setup, then retry validation."
  }
  if (mailbox.status === "warning") {
    return "Confirm the connected Google account matches this mailbox email."
  }
  if (mailbox.status !== "connected") {
    return "Complete Gmail connection before scaling outbound volume."
  }
  return null
}

function useConnectedMailboxesNavPaths(oauthReturnTo?: string) {
  const pathname = usePathname() ?? ""
  const isGrowthCommunicationsSettings = isGrowthCommunicationsSettingsPath(pathname)
  const isGrowthWorkspace = isGrowthWorkspacePathname(pathname)

  const workspaceCommPaths = {
    returnTo: GROWTH_WORKSPACE_MAILBOXES_PATH,
    senderHref: GROWTH_WORKSPACE_SENDER_SETUP_PATH,
    poolHref: GROWTH_WORKSPACE_SENDER_POOLS_PATH,
    deliverabilityHref: GROWTH_WORKSPACE_DNS_VERIFICATION_PATH,
    warmupHref: GROWTH_WORKSPACE_WARMUP_PATH,
    reputationHref: GROWTH_WORKSPACE_REPUTATION_PATH,
    onboardHref: GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH,
  }

  if (oauthReturnTo) {
    return {
      returnTo: oauthReturnTo,
      senderHref: GROWTH_WORKSPACE_SENDER_SETUP_PATH,
      poolHref: GROWTH_WORKSPACE_SENDER_POOLS_PATH,
      deliverabilityHref: GROWTH_WORKSPACE_DNS_VERIFICATION_PATH,
      warmupHref: GROWTH_WORKSPACE_WARMUP_PATH,
      reputationHref: GROWTH_WORKSPACE_REPUTATION_PATH,
      onboardHref: GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH,
    }
  }

  if (isGrowthCommunicationsSettings) {
    return {
      returnTo: pathname || GROWTH_COMMUNICATIONS_MAILBOXES_PATH,
      senderHref: GROWTH_WORKSPACE_SENDER_SETUP_PATH,
      poolHref: GROWTH_WORKSPACE_SENDER_POOLS_PATH,
      deliverabilityHref: GROWTH_WORKSPACE_DNS_VERIFICATION_PATH,
      warmupHref: GROWTH_WORKSPACE_WARMUP_PATH,
      reputationHref: GROWTH_WORKSPACE_REPUTATION_PATH,
      onboardHref: GROWTH_COMMUNICATIONS_MAILBOXES_ONBOARD_PATH,
    }
  }

  if (isGrowthWorkspace) {
    return workspaceCommPaths
  }

  return {
    returnTo: pathname || "/admin/growth/infrastructure/mailboxes",
    senderHref: `${GROWTH_ADMIN_BASE_PATH}/infrastructure`,
    poolHref: `${GROWTH_ADMIN_BASE_PATH}/providers/sender-pools`,
    deliverabilityHref: `${GROWTH_ADMIN_BASE_PATH}/infrastructure/deliverability`,
    warmupHref: `${GROWTH_ADMIN_BASE_PATH}/infrastructure/warmup`,
    reputationHref: `${GROWTH_ADMIN_BASE_PATH}/deliverability`,
    onboardHref: `${GROWTH_ADMIN_BASE_PATH}/infrastructure/mailboxes/onboard`,
  }
}

export function GrowthConnectedMailboxesDashboard({
  oauthReturnTo,
}: {
  oauthReturnTo?: string
} = {}) {
  const searchParams = useSearchParams()
  const navPaths = useConnectedMailboxesNavPaths(oauthReturnTo)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthConnectedMailboxesDashboardPayload | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [oauthNotice, setOauthNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState<GrowthConnectedMailboxFilter>("all")
  const [domainFilter, setDomainFilter] = useState("")
  const [poolFilter, setPoolFilter] = useState("")
  const [testSendRow, setTestSendRow] = useState<GrowthConnectedMailboxRow | null>(null)
  const [testSendTo, setTestSendTo] = useState("")
  const [testSendApproval, setTestSendApproval] = useState(false)
  const [validationFeedback, setValidationFeedback] = useState<Record<string, MailboxValidationFeedback>>({})
  const [warmupNotice, setWarmupNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/mailboxes/operator-dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthConnectedMailboxesDashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load connected mailboxes dashboard.")
      }
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const providerConnected = searchParams.get("provider_connected")
    const providerError = searchParams.get("provider_error")
    if (providerConnected === "google") {
      setOauthNotice({
        tone: "success",
        message: "Gmail connected successfully. Tokens are encrypted and live validation passed.",
      })
    } else if (providerError) {
      setOauthNotice({
        tone: "error",
        message: `Gmail reconnect failed: ${providerError.replace(/_/g, " ")}.`,
      })
    }
  }, [searchParams])

  const filteredRows = useMemo(() => {
    if (!dashboard) return []
    return dashboard.rows.filter((row) => {
      if (statusFilter === "connected" && row.connectionStatus !== "connected") return false
      if (statusFilter === "warming" && !isWarmingRow(row)) return false
      if (statusFilter === "paused" && !isPausedRow(row)) return false
      if (statusFilter === "unhealthy" && !isUnhealthyRow(row)) return false
      if (domainFilter && row.domain !== domainFilter) return false
      if (poolFilter && !row.poolMemberships.some((entry) => entry.poolId === poolFilter)) return false
      return true
    })
  }, [dashboard, statusFilter, domainFilter, poolFilter])

  async function runAction(key: string, fn: () => Promise<void>) {
    setActionLoading(key)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActionLoading(null)
    }
  }

  async function startGoogleOAuth(row: GrowthConnectedMailboxRow) {
    const res = await fetch("/api/platform/growth/provider-setup/google/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_account_id: row.senderId,
        mailbox_connection_id: row.mailboxId ?? undefined,
        return_to: navPaths.returnTo,
        workspace: navPaths.returnTo.startsWith("/admin/growth/providers") ? "admin" : "growth",
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { authorize_url?: string; message?: string }
    if (!res.ok || !data.authorize_url) {
      throw new Error(data.message ?? "Google OAuth could not start.")
    }
    window.location.href = data.authorize_url
  }

  async function validateMailbox(row: GrowthConnectedMailboxRow) {
    if (!row.mailboxId) throw new Error("No mailbox connection to validate.")
    const res = await fetch(`/api/platform/growth/mailboxes/${row.mailboxId}/validate`, { method: "POST" })
    const data = (await res.json().catch(() => ({}))) as {
      message?: string
      mailbox?: GrowthMailboxConnectionSummary
    }
    if (!res.ok) {
      const failureMessage = data.message ?? "Validation failed."
      setValidationFeedback((prev) => ({
        ...prev,
        [row.senderId]: {
          ok: false,
          message: failureMessage,
          status: row.connectionStatus,
          healthTier: row.healthTier,
          healthReason: null,
          lastValidationAt: row.lastValidationAt,
          suggestedNextStep: row.needsReconnect ? "Reconnect Gmail to refresh OAuth tokens." : "Retry validation or contact support.",
        },
      }))
      throw new Error(failureMessage)
    }

    const mailbox = data.mailbox
    if (!mailbox) return

    setValidationFeedback((prev) => ({
      ...prev,
      [row.senderId]: {
        ok: mailbox.status === "connected",
        message: mailbox.validation_message ?? mailbox.health_reason ?? "Validation completed.",
        status: mailbox.status,
        healthTier: mailbox.health_tier,
        healthReason: mailbox.health_reason,
        lastValidationAt: mailbox.last_validation_at,
        suggestedNextStep: validationSuggestedNextStep(row, mailbox),
      },
    }))
  }

  async function startWarmup(row: GrowthConnectedMailboxRow) {
    const res = await fetch("/api/platform/growth/warmup/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderAccountId: row.senderId, warmupDays: 30 }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      message?: string
      action?: string
    }
    if (!res.ok || !data.ok) {
      throw new Error(data.message ?? "Could not start warmup schedule.")
    }

    setWarmupNotice({
      tone: "success",
      message: data.message ?? `Warmup updated for ${row.email}.`,
    })
  }

  async function pauseSender(row: GrowthConnectedMailboxRow) {
    const res = await fetch(`/api/platform/growth/senders/${row.senderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "disabled" }),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Could not pause sender.")
    for (const membership of row.poolMemberships) {
      if (membership.memberStatus !== "paused" && membership.memberStatus !== "blocked") {
        await fetch(`/api/platform/growth/sender-pools/${membership.poolId}/members/${membership.memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberStatus: "paused", operationalPauseReason: "operator_pause" }),
        })
      }
    }
  }

  async function resumeSender(row: GrowthConnectedMailboxRow) {
    const res = await fetch(`/api/platform/growth/senders/${row.senderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "connected" }),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Could not resume sender.")
    for (const membership of row.poolMemberships) {
      if (membership.memberStatus === "paused") {
        await fetch(`/api/platform/growth/sender-pools/${membership.poolId}/members/${membership.memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberStatus: "eligible", operationalPauseReason: null }),
        })
      }
    }
  }

  async function removeFromPool(poolId: string, memberId: string) {
    const res = await fetch(`/api/platform/growth/sender-pools/${poolId}/members/${memberId}`, { method: "DELETE" })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Could not remove from pool.")
  }

  async function runTestSend() {
    if (!testSendRow || !testSendTo.trim()) throw new Error("Recipient email is required.")
    if (!testSendApproval) throw new Error("Human approval is required for test sends.")
    const res = await fetch("/api/platform/growth/provider-setup/google/test-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_account_id: testSendRow.senderId,
        to: testSendTo.trim(),
        humanApprovalConfirmed: true,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; result?: { message?: string } }
    if (!res.ok || !data.ok) {
      throw new Error(data.message ?? data.result?.message ?? "Test send failed.")
    }
    setTestSendRow(null)
    setTestSendTo("")
    setTestSendApproval(false)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading connected mailboxes…
      </div>
    )
  }

  const summary = dashboard?.summary

  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa={GROWTH_CONNECTED_MAILBOXES_QA_MARKER}
      data-growth-settings-communications-refinement={GROWTH_SETTINGS_COMMUNICATIONS_REFINEMENT_2C_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {summary
            ? `${summary.connectedMailboxes} connected · ${summary.healthyMailboxes} healthy · ${summary.warningMailboxes} warning · ${summary.disconnectedMailboxes} disconnected`
            : "Manage Gmail connections, warmup, and daily send limits per mailbox."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" asChild>
            <Link href={navPaths.onboardHref}>Onboard mailbox</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(actionLoading)}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {oauthNotice ? (
        <div
          className={
            oauthNotice.tone === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          }
        >
          {oauthNotice.message}
        </div>
      ) : null}

      {warmupNotice ? (
        <div
          className={
            warmupNotice.tone === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          }
        >
          {warmupNotice.message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Overview">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Connected" value={String(summary?.connectedMailboxes ?? 0)} />
          <StatTile label="Healthy" value={String(summary?.healthyMailboxes ?? 0)} />
          <StatTile label="Warning" value={String(summary?.warningMailboxes ?? 0)} />
          <StatTile label="Disconnected" value={String(summary?.disconnectedMailboxes ?? 0)} />
          <StatTile
            label="Daily volume"
            value={`${summary?.dailyUsed ?? 0} / ${summary?.dailyCapacity ?? 0}`}
          />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Connected Mailboxes">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="min-w-[140px] space-y-1.5">
            <Label htmlFor="mailbox-status-filter">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as GrowthConnectedMailboxFilter)}
            >
              <SelectTrigger id="mailbox-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="warming">Warming</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="unhealthy">Unhealthy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px] space-y-1.5">
            <Label htmlFor="mailbox-domain-filter">Domain</Label>
            <Select value={domainFilter || "__all__"} onValueChange={(v) => setDomainFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger id="mailbox-domain-filter">
                <SelectValue placeholder="All domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All domains</SelectItem>
                {(dashboard?.domains ?? []).map((domain) => (
                  <SelectItem key={domain} value={domain}>
                    {domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px] space-y-1.5">
            <Label htmlFor="mailbox-pool-filter">Pool</Label>
            <Select value={poolFilter || "__all__"} onValueChange={(v) => setPoolFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger id="mailbox-pool-filter">
                <SelectValue placeholder="All pools" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All pools</SelectItem>
                {(dashboard?.pools ?? []).map((pool) => (
                  <SelectItem key={pool.id} value={pool.id}>
                    {pool.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            <p>No mailboxes match the current filters.</p>
            <Button type="button" size="sm" className="mt-3" asChild>
              <Link href={navPaths.onboardHref}>Onboard a mailbox</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredRows.map((row) => {
              const primaryPool = row.poolMemberships[0]
              const googleOAuth = row.providerFamily === "google"
              const oauthLabel = row.mailboxTokenConfigured ? "Reconnect Gmail" : "Connect Gmail"
              const senderPaused = row.senderStatus === "disabled"
              const warmupDisplay = resolveConnectedMailboxWarmupDisplay(row)
              const cardHealth = resolveMailboxCardHealthDisplay(row)
              const validation = validationFeedback[row.senderId]
              return (
                <article
                  key={row.senderId}
                  className={cn("rounded-xl border p-4 shadow-sm", mailboxHealthAccent(row))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-tight">{row.email}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {row.senderDisplayName} · {row.domain}
                      </p>
                    </div>
                    <GrowthBadge label={providerLabel(row.providerFamily)} tone="neutral" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <GrowthBadge
                      label={cardHealth.label}
                      tone={canonicalHealthTone(cardHealth.state)}
                    />
                    <GrowthBadge label={row.senderStatus} tone={STATUS_TONE[row.senderStatus] ?? "neutral"} />
                    {row.needsReconnect ? <GrowthBadge label="Reconnect required" tone="attention" /> : null}
                    <span className="self-center text-xs text-muted-foreground">{row.healthScore}% health</span>
                    <GrowthBadge label={warmupDisplay.label} tone={warmupDisplay.tone} />
                  </div>

                  {row.warningReasons.length > 0 ? (
                    <div className="mt-3 rounded-md border border-amber-200/80 bg-amber-50/60 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                      <p className="font-medium">Warning</p>
                      <ul className="mt-1 space-y-0.5">
                        {row.warningReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">Daily cap</dt>
                      <dd className="font-medium">{row.dailyCap}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Daily used</dt>
                      <dd className="font-medium">{row.dailyUsed}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Pool</dt>
                      <dd className="font-medium">{primaryPool?.poolName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Signature</dt>
                      <dd className="font-medium">
                        {row.signatureStatus === "configured"
                          ? "Configured"
                          : row.signatureStatus === "inherited"
                            ? "Inherited"
                            : "Missing"}
                      </dd>
                    </div>
                  </dl>

                  {validation ? (
                    <div
                      className={cn(
                        "mt-3 rounded-md border px-2 py-1.5 text-xs",
                        validation.ok
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-rose-200 bg-rose-50 text-rose-900",
                      )}
                    >
                      <p>{validation.message}</p>
                      {validation.suggestedNextStep ? (
                        <p className="mt-1 font-medium">{validation.suggestedNextStep}</p>
                      ) : null}
                    </div>
                  ) : row.lastValidationAt ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last validated {formatDate(row.lastValidationAt)}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {googleOAuth ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={row.needsReconnect ? "default" : "outline"}
                        disabled={Boolean(actionLoading) || senderPaused}
                        onClick={() => void runAction(`oauth-${row.senderId}`, () => startGoogleOAuth(row))}
                      >
                        {actionLoading === `oauth-${row.senderId}` ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <Plug className="mr-1 size-3.5" />
                        )}
                        {oauthLabel}
                      </Button>
                    ) : null}
                    {row.mailboxId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={Boolean(actionLoading)}
                        onClick={() => void runAction(`validate-${row.senderId}`, () => validateMailbox(row))}
                      >
                        Validate
                      </Button>
                    ) : null}
                    {warmupDisplay.canStart ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={Boolean(actionLoading) || row.connectionStatus !== "connected"}
                        onClick={() =>
                          void runAction(`warmup-start-${row.senderId}`, async () => {
                            setWarmupNotice(null)
                            await startWarmup(row)
                          })
                        }
                      >
                        Start warmup
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={growthCommunicationsWarmupHref(row.senderId)}>View warmup</Link>
                      </Button>
                    )}
                    {row.signatureStatus === "missing" ? (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={growthEngineCustomerSettingsHref("email-signatures")}>Add signature</Link>
                      </Button>
                    ) : null}
                    {senderPaused ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={Boolean(actionLoading)}
                        onClick={() => void runAction(`resume-${row.senderId}`, () => resumeSender(row))}
                      >
                        Resume
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(actionLoading)}
                        onClick={() => void runAction(`pause-${row.senderId}`, () => pauseSender(row))}
                      >
                        Pause
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={
                        Boolean(actionLoading) || !row.deliveryRouteEnabled || row.providerFamily !== "google"
                      }
                      onClick={() => {
                        setTestSendRow(row)
                        setTestSendTo("")
                        setTestSendApproval(false)
                      }}
                    >
                      <Send className="mr-1 size-3.5" />
                      Test send
                    </Button>
                    {primaryPool ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={Boolean(actionLoading)}
                        onClick={() =>
                          void runAction(`remove-pool-${row.senderId}`, () =>
                            removeFromPool(primaryPool.poolId, primaryPool.memberId),
                          )
                        }
                      >
                        Remove from pool
                      </Button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </GrowthEngineCard>

      <Dialog open={Boolean(testSendRow)} onOpenChange={(open) => !open && setTestSendRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test send</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Send a live provider test email from {testSendRow?.email}. Human approval is required.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="connected-mailbox-test-to">Recipient</Label>
              <Input
                id="connected-mailbox-test-to"
                type="email"
                value={testSendTo}
                onChange={(e) => setTestSendTo(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="connected-mailbox-test-approval"
                checked={testSendApproval}
                onCheckedChange={(v) => setTestSendApproval(v === true)}
              />
              <Label htmlFor="connected-mailbox-test-approval" className="text-sm font-normal">
                I confirm this live test send is authorized
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTestSendRow(null)}>Cancel</Button>
            <Button
              type="button"
              disabled={
                Boolean(actionLoading) || !testSendTo.trim() || !testSendApproval || !testSendRow
              }
              onClick={() => void runAction("test-send", runTestSend)}
            >
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GrowthConnectedMailboxesDashboard
