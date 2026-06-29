"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthDomainDeliverabilityDomainsTable } from "@/components/growth/growth-domain-deliverability-domains-table"
import type {
  GrowthSenderAccount,
  GrowthSenderDomain,
  GrowthSenderHealthEvent,
  GrowthSenderInfrastructureDashboard,
  GrowthSenderProviderFamily,
} from "@/lib/growth/sender/sender-types"
import { GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER } from "@/lib/growth/sender/sender-types"
import { senderHealthStatusLabel } from "@/lib/growth/sender/sender-score"

const PROVIDER_LABELS: Record<GrowthSenderProviderFamily, string> = {
  google: "Google",
  microsoft: "Microsoft",
  smtp: "SMTP",
  custom: "Custom",
}

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  connected: "healthy",
  healthy: "healthy",
  warning: "attention",
  warming: "attention",
  degraded: "attention",
  critical: "critical",
  error: "critical",
  invalid: "critical",
  pending: "neutral",
  connecting: "neutral",
  disabled: "blocked",
  valid: "healthy",
}

const SEVERITY_TONE: Record<string, "healthy" | "medium" | "attention" | "critical" | "neutral"> = {
  low: "neutral",
  medium: "medium",
  high: "attention",
  critical: "critical",
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthSenderInfrastructureDashboard
  healthEvents?: GrowthSenderHealthEvent[]
  message?: string
}

type SendersPayload = {
  ok?: boolean
  senders?: GrowthSenderAccount[]
  message?: string
}

type DomainsPayload = {
  ok?: boolean
  domains?: GrowthSenderDomain[]
  message?: string
}

export function GrowthSenderInfrastructureDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthSenderInfrastructureDashboard | null>(null)
  const [senders, setSenders] = useState<GrowthSenderAccount[]>([])
  const [domains, setDomains] = useState<GrowthSenderDomain[]>([])
  const [healthEvents, setHealthEvents] = useState<GrowthSenderHealthEvent[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GrowthSenderAccount | null>(null)

  const [newProvider, setNewProvider] = useState<GrowthSenderProviderFamily>("google")
  const [newDisplayName, setNewDisplayName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newDailyLimit, setNewDailyLimit] = useState("50")
  const [newNotes, setNewNotes] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardRes, sendersRes, domainsRes] = await Promise.all([
        fetch("/api/platform/growth/senders/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/senders", { cache: "no-store" }),
        fetch("/api/platform/growth/senders/domains", { cache: "no-store" }),
      ])

      const dashboardData = (await dashboardRes.json().catch(() => ({}))) as DashboardPayload
      const sendersData = (await sendersRes.json().catch(() => ({}))) as SendersPayload
      const domainsData = (await domainsRes.json().catch(() => ({}))) as DomainsPayload

      if (!dashboardRes.ok || !dashboardData.ok || !dashboardData.dashboard) {
        throw new Error(dashboardData.message ?? "Could not load sender infrastructure dashboard.")
      }

      setDashboard(dashboardData.dashboard)
      setHealthEvents(dashboardData.healthEvents ?? [])
      setSenders(sendersRes.ok && sendersData.ok ? sendersData.senders ?? [] : [])
      setDomains(domainsRes.ok && domainsData.ok ? domainsData.domains ?? [] : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const senderMetrics = useMemo(
    () => ({
      connected: dashboard?.connected_senders ?? 0,
      healthy: dashboard?.healthy_senders ?? 0,
      warning: dashboard?.warning_senders ?? 0,
      disabled: dashboard?.disabled_senders ?? 0,
      averageScore: dashboard?.average_sender_score ?? 0,
    }),
    [dashboard],
  )

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

  async function createSender() {
    if (!newDisplayName.trim() || !newEmail.trim()) {
      throw new Error("Display name and email are required.")
    }

    const res = await fetch("/api/platform/growth/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerFamily: newProvider,
        displayName: newDisplayName.trim(),
        emailAddress: newEmail.trim(),
        dailySendLimit: Number(newDailyLimit) || 50,
        notes: newNotes.trim() || null,
        status: "pending",
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Could not create sender.")

    setNewDisplayName("")
    setNewEmail("")
    setNewNotes("")
  }

  async function disableSender(sender: GrowthSenderAccount) {
    const res = await fetch(`/api/platform/growth/senders/${sender.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "disabled" }),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Could not disable sender.")
  }

  async function deleteSender(sender: GrowthSenderAccount) {
    const res = await fetch(`/api/platform/growth/senders/${sender.id}`, { method: "DELETE" })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Could not delete sender.")
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading sender infrastructure…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER} · Infrastructure only — no outbound sending, OAuth, or DNS execution.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure/mailboxes">Mailbox Connections</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure/deliverability">Deliverability</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={Boolean(actionLoading)}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Sender Accounts">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Connected" value={String(senderMetrics.connected)} />
          <StatTile label="Healthy" value={String(senderMetrics.healthy)} />
          <StatTile label="Warning" value={String(senderMetrics.warning)} />
          <StatTile label="Disabled" value={String(senderMetrics.disabled)} />
          <StatTile label="Average sender score" value={`${senderMetrics.averageScore}%`} />
        </div>

        <div className="mt-6 grid gap-3 rounded-xl border border-dashed border-border p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="sender-provider">Provider</Label>
            <Select value={newProvider} onValueChange={(value) => setNewProvider(value as GrowthSenderProviderFamily)}>
              <SelectTrigger id="sender-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sender-name">Display name</Label>
            <Input id="sender-name" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sender-email">Email</Label>
            <Input id="sender-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sender-limit">Daily limit</Label>
            <Input id="sender-limit" type="number" min={0} value={newDailyLimit} onChange={(e) => setNewDailyLimit(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              disabled={Boolean(actionLoading)}
              onClick={() => void runAction("create", createSender)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Register sender
            </Button>
          </div>
          <div className="space-y-1.5 xl:col-span-5">
            <Label htmlFor="sender-notes">Notes</Label>
            <Textarea id="sender-notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Provider</th>
                <th className="px-2 py-2">Health</th>
                <th className="px-2 py-2">Daily limit</th>
                <th className="px-2 py-2">Daily used</th>
                <th className="px-2 py-2">Warmup eligible</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {senders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-muted-foreground">
                    No sender accounts registered yet.
                  </td>
                </tr>
              ) : (
                senders.map((sender) => (
                  <tr key={sender.id} className="border-b border-border/60">
                    <td className="px-2 py-3">
                      <div className="font-medium">{sender.email_address}</div>
                      <div className="text-xs text-muted-foreground">{sender.display_name}</div>
                    </td>
                    <td className="px-2 py-3">{PROVIDER_LABELS[sender.provider_family]}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <GrowthBadge
                          label={senderHealthStatusLabel(sender.health_status)}
                          tone={STATUS_TONE[sender.health_status] ?? "neutral"}
                        />
                        <span className="text-xs text-muted-foreground">{sender.sender_score}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-3">{sender.daily_send_limit}</td>
                    <td className="px-2 py-3">{sender.daily_send_used}</td>
                    <td className="px-2 py-3">{sender.warmup_eligible ? "Yes" : "No"}</td>
                    <td className="px-2 py-3">
                      <GrowthBadge label={sender.status} tone={STATUS_TONE[sender.status] ?? "neutral"} />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading) || sender.status === "disabled"}
                          onClick={() => void runAction(`disable-${sender.id}`, () => disableSender(sender))}
                        >
                          Disable
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(actionLoading)}
                          onClick={() => setDeleteTarget(sender)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Domains">
        <p className="mb-3 text-sm text-muted-foreground">
          Click a domain row or use Actions to open DNS setup instructions (MX, SPF, DKIM, DMARC).
        </p>
        <GrowthDomainDeliverabilityDomainsTable
          rows={domains.map((domain) => ({
            domainId: domain.id,
            domain: domain.domain,
            spfValid: domain.spf_valid,
            dkimValid: domain.dkim_valid,
            dmarcValid: domain.dmarc_valid,
            mxValid: domain.mx_valid,
            deliverabilityScore: domain.deliverability_score,
            healthLabel: domain.status,
            lastCheckedAt: domain.dns_checked_at ?? domain.last_verified_at,
          }))}
          onDomainUpdated={() => void load()}
          emptyMessage="Domains appear when sender emails are registered."
        />
      </GrowthEngineCard>

      <GrowthEngineCard title="Health Feed">
        {healthEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sender health events recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {healthEvents.map((event) => (
              <li key={event.id} className="rounded-lg border border-border/80 bg-background px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{event.title}</p>
                  <GrowthBadge label={event.severity} tone={SEVERITY_TONE[event.severity] ?? "neutral"} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                <p className="mt-1 text-sm text-foreground/90">{event.description}</p>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove sender account?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes {deleteTarget?.email_address} from sender infrastructure. No outbound messages are sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(actionLoading)}
              onClick={() => deleteTarget && void runAction(`delete-${deleteTarget.id}`, () => deleteSender(deleteTarget))}
            >
              Remove sender
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default GrowthSenderInfrastructureDashboard
