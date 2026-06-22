"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, Plug, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthMailboxConnectionEvent,
  GrowthMailboxConnectionSummary,
  GrowthMailboxHealthDashboard,
} from "@/lib/growth/mailboxes/mailbox-types"
import { GROWTH_MAILBOX_CONNECTION_QA_MARKER } from "@/lib/growth/mailboxes/mailbox-types"
import type { GrowthSenderAccount, GrowthSenderProviderFamily } from "@/lib/growth/sender/sender-types"

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
  degraded: "attention",
  expired: "attention",
  critical: "critical",
  error: "critical",
  pending: "neutral",
  connecting: "neutral",
  disabled: "blocked",
}

const SEVERITY_TONE: Record<string, "healthy" | "medium" | "attention" | "critical" | "neutral"> = {
  low: "neutral",
  medium: "medium",
  high: "attention",
  critical: "critical",
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

function googleMailboxNeedsReconnect(mailbox: GrowthMailboxConnectionSummary): boolean {
  if (mailbox.provider_family !== "google") return false
  if (mailbox.status === "disabled") return false
  return (
    !mailbox.token_configured ||
    mailbox.status === "error" ||
    mailbox.status === "expired" ||
    mailbox.status === "pending" ||
    mailbox.status === "connecting"
  )
}

function googleReconnectLabel(mailbox: GrowthMailboxConnectionSummary): string {
  return mailbox.token_configured ? "Reconnect Gmail" : "Connect Gmail"
}

export function GrowthMailboxConnectionsDashboard() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mailboxes, setMailboxes] = useState<GrowthMailboxConnectionSummary[]>([])
  const [senders, setSenders] = useState<GrowthSenderAccount[]>([])
  const [dashboard, setDashboard] = useState<GrowthMailboxHealthDashboard | null>(null)
  const [events, setEvents] = useState<GrowthMailboxConnectionEvent[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GrowthMailboxConnectionSummary | null>(null)
  const [oauthNotice, setOauthNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null)

  const [newSenderId, setNewSenderId] = useState("")
  const [newProvider, setNewProvider] = useState<GrowthSenderProviderFamily>("google")
  const [newDisplayName, setNewDisplayName] = useState("")
  const [newEmail, setNewEmail] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [listRes, healthRes] = await Promise.all([
        fetch("/api/platform/growth/mailboxes", { cache: "no-store" }),
        fetch("/api/platform/growth/mailboxes/health", { cache: "no-store" }),
      ])
      const listData = (await listRes.json().catch(() => ({}))) as {
        ok?: boolean
        mailboxes?: GrowthMailboxConnectionSummary[]
        senders?: GrowthSenderAccount[]
        message?: string
      }
      const healthData = (await healthRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthMailboxHealthDashboard
        events?: GrowthMailboxConnectionEvent[]
        message?: string
      }

      if (!listRes.ok || !listData.ok || !listData.mailboxes) {
        throw new Error(listData.message ?? "Could not load mailbox connections.")
      }
      if (!healthRes.ok || !healthData.ok || !healthData.dashboard) {
        throw new Error(healthData.message ?? "Could not load mailbox health.")
      }

      setMailboxes(listData.mailboxes)
      setSenders(listData.senders ?? [])
      setDashboard(healthData.dashboard)
      setEvents(healthData.events ?? [])
      setNewSenderId((current) => current || listData.senders?.[0]?.id || "")
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
        message: "Gmail connected successfully. Tokens are encrypted and live validation passed (send + inbox read).",
      })
    } else if (providerError) {
      setOauthNotice({
        tone: "error",
        message: `Gmail reconnect failed: ${providerError.replace(/_/g, " ")}.`,
      })
    }
  }, [searchParams])

  const reconnectSenderId = searchParams.get("reconnect_sender")?.trim() || null

  const healthFeed = useMemo(() => {
    return events.filter((event) =>
      ["validation_failed", "token_expired", "health_declined", "disconnected"].some((type) =>
        event.event_type.includes(type),
      ),
    )
  }, [events])

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

  async function connectMailbox() {
    if (!newSenderId || !newDisplayName.trim() || !newEmail.trim()) {
      throw new Error("Sender account, display name, and email are required.")
    }
    const res = await fetch("/api/platform/growth/mailboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderAccountId: newSenderId,
        providerFamily: newProvider,
        displayName: newDisplayName.trim(),
        emailAddress: newEmail.trim(),
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Could not connect mailbox.")
    setNewDisplayName("")
    setNewEmail("")
  }

  async function validateMailbox(mailbox: GrowthMailboxConnectionSummary) {
    const res = await fetch(`/api/platform/growth/mailboxes/${mailbox.id}/validate`, { method: "POST" })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Validation failed.")
  }

  async function disableMailbox(mailbox: GrowthMailboxConnectionSummary) {
    const res = await fetch(`/api/platform/growth/mailboxes/${mailbox.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "disabled" }),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Could not disable mailbox.")
  }

  async function deleteMailbox(mailbox: GrowthMailboxConnectionSummary) {
    const res = await fetch(`/api/platform/growth/mailboxes/${mailbox.id}`, { method: "DELETE" })
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (!res.ok) throw new Error(data.message ?? "Could not delete mailbox.")
    setDeleteTarget(null)
  }

  async function startGoogleOAuthReconnect(mailbox: GrowthMailboxConnectionSummary) {
    const res = await fetch("/api/platform/growth/provider-setup/google/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_account_id: mailbox.sender_account_id,
        mailbox_connection_id: mailbox.id,
        return_to: "/growth/settings/communications/mailboxes",
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      authorize_url?: string
      message?: string
      error?: string
    }
    if (!res.ok || !data.authorize_url) {
      throw new Error(data.message ?? "Google OAuth is not configured or could not start reconnect.")
    }
    window.location.href = data.authorize_url
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading mailbox connections…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_MAILBOX_CONNECTION_QA_MARKER} · Google OAuth reconnect stores encrypted send + inbox-read tokens for
          outbound delivery and inbox sync.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/infrastructure">Sender Infrastructure</Link>
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

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Mailbox Health">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Connected" value={String(dashboard?.connected_count ?? 0)} />
          <StatTile label="Warning" value={String(dashboard?.warning_count ?? 0)} />
          <StatTile label="Expired" value={String(dashboard?.expired_count ?? 0)} />
          <StatTile label="Failed validation" value={String(dashboard?.failed_validation_count ?? 0)} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Mailbox Connections">
        <div className="mb-4 grid gap-3 rounded-xl border border-dashed border-border p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="mailbox-sender">Sender account</Label>
            <Select value={newSenderId} onValueChange={setNewSenderId}>
              <SelectTrigger id="mailbox-sender">
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent>
                {senders.map((sender) => (
                  <SelectItem key={sender.id} value={sender.id}>
                    {sender.email_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mailbox-provider">Provider</Label>
            <Select value={newProvider} onValueChange={(value) => setNewProvider(value as GrowthSenderProviderFamily)}>
              <SelectTrigger id="mailbox-provider">
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
            <Label htmlFor="mailbox-name">Display name</Label>
            <Input id="mailbox-name" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mailbox-email">Email</Label>
            <Input id="mailbox-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              className="w-full"
              disabled={Boolean(actionLoading) || senders.length === 0}
              onClick={() => void runAction("connect", connectMailbox)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Connect mailbox
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/growth/settings/communications/mailboxes">Communications</Link>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Provider</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Health</th>
                <th className="px-2 py-2">Token expiration</th>
                <th className="px-2 py-2">Last validation</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mailboxes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-muted-foreground">
                    No mailbox connections yet. Register a sender account first, then connect a mailbox.
                  </td>
                </tr>
              ) : (
                mailboxes.map((mailbox) => {
                  const highlightReconnect =
                    reconnectSenderId != null && mailbox.sender_account_id === reconnectSenderId
                  const needsReconnect = googleMailboxNeedsReconnect(mailbox)
                  return (
                  <tr
                    key={mailbox.id}
                    className={
                      highlightReconnect
                        ? "border-b border-amber-300/80 bg-amber-50/40"
                        : "border-b border-border/60"
                    }
                  >
                    <td className="px-2 py-3">
                      <div className="font-medium">{mailbox.email_address}</div>
                      <div className="text-xs text-muted-foreground">{mailbox.display_name}</div>
                      {mailbox.health_reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">{mailbox.health_reason}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-3">{PROVIDER_LABELS[mailbox.provider_family]}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-col gap-1">
                        <GrowthBadge label={mailbox.status} tone={STATUS_TONE[mailbox.status] ?? "neutral"} />
                        <span className="text-xs text-muted-foreground">
                          {mailbox.token_configured ? "Tokens stored" : "No OAuth tokens"}
                        </span>
                        {needsReconnect ? (
                          <GrowthBadge label="Reconnect required" tone="attention" />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <GrowthBadge label={mailbox.health_tier} tone={STATUS_TONE[mailbox.health_tier] ?? "neutral"} />
                        <span className="text-xs text-muted-foreground">{mailbox.connection_health}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-3">{formatDate(mailbox.token_expires_at)}</td>
                    <td className="px-2 py-3">{formatDate(mailbox.last_validation_at)}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        {mailbox.provider_family === "google" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={needsReconnect ? "default" : "outline"}
                            disabled={Boolean(actionLoading) || mailbox.status === "disabled"}
                            onClick={() =>
                              void runAction(`oauth-${mailbox.id}`, () => startGoogleOAuthReconnect(mailbox))
                            }
                          >
                            {actionLoading === `oauth-${mailbox.id}` ? (
                              <Loader2 className="mr-1 size-3.5 animate-spin" />
                            ) : (
                              <Plug className="mr-1 size-3.5" />
                            )}
                            {googleReconnectLabel(mailbox)}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={() => void runAction(`validate-${mailbox.id}`, () => validateMailbox(mailbox))}
                        >
                          Validate
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading) || mailbox.status === "disabled"}
                          onClick={() => void runAction(`disable-${mailbox.id}`, () => disableMailbox(mailbox))}
                        >
                          Disable
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(actionLoading)}
                          onClick={() => setDeleteTarget(mailbox)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Health Feed">
        {healthFeed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent mailbox failures or expiry warnings.</p>
        ) : (
          <ul className="space-y-3">
            {healthFeed.map((event) => (
              <li key={event.id} className="rounded-lg border border-border/80 bg-background px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{event.title}</p>
                  <GrowthBadge label={event.severity} tone={SEVERITY_TONE[event.severity] ?? "neutral"} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
                <p className="mt-1 text-sm text-foreground/90">{event.description}</p>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove mailbox connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This soft-deletes {deleteTarget?.email_address}. Tokens remain encrypted at rest; no outbound sending occurs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(actionLoading)}
              onClick={() => deleteTarget && void runAction(`delete-${deleteTarget.id}`, () => deleteMailbox(deleteTarget))}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
