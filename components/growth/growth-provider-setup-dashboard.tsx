"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plug, RefreshCw, Send, ShieldCheck } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthProviderSetupDashboard } from "@/lib/growth/provider-setup/provider-setup-types"
import { GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER } from "@/lib/growth/provider-setup/provider-setup-types"
import type { GrowthSenderAccount } from "@/lib/growth/sender/sender-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked"> = {
  connected: "healthy",
  warning: "attention",
  pending: "neutral",
  expired: "attention",
  failed: "critical",
  disabled: "blocked",
  not_configured: "neutral",
}

export function GrowthProviderSetupDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthProviderSetupDashboard | null>(null)
  const [senders, setSenders] = useState<GrowthSenderAccount[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedSenderId, setSelectedSenderId] = useState("")
  const [testTo, setTestTo] = useState("")
  const [humanApprovalConfirmed, setHumanApprovalConfirmed] = useState(false)

  const [smtpHost, setSmtpHost] = useState("")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPassword, setSmtpPassword] = useState("")
  const [sesKey, setSesKey] = useState("")
  const [sesSecret, setSesSecret] = useState("")
  const [sesRegion, setSesRegion] = useState("us-east-1")
  const [resendApiKey, setResendApiKey] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashRes, sendersRes] = await Promise.all([
        fetch("/api/platform/growth/provider-setup/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/senders", { cache: "no-store" }).catch(() => null),
      ])
      const dashData = (await dashRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthProviderSetupDashboard
        message?: string
      }
      if (!dashRes.ok || !dashData.ok || !dashData.dashboard) {
        throw new Error(dashData.message ?? "Could not load provider setup dashboard.")
      }
      setDashboard(dashData.dashboard)

      if (sendersRes?.ok) {
        const senderData = (await sendersRes.json().catch(() => ({}))) as {
          senders?: GrowthSenderAccount[]
        }
        setSenders(senderData.senders ?? [])
        setSelectedSenderId((current) => current || senderData.senders?.[0]?.id || "")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const readinessSummary = useMemo(() => {
    if (!dashboard) return { pass: 0, fail: 0, warning: 0 }
    return dashboard.global_readiness.reduce(
      (acc, item) => {
        acc[item.status === "pass" ? "pass" : item.status === "warning" ? "warning" : "fail"] += 1
        return acc
      },
      { pass: 0, fail: 0, warning: 0 },
    )
  }, [dashboard])

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

  async function startOAuth(provider: "google" | "microsoft") {
    const res = await fetch(`/api/platform/growth/provider-setup/${provider}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_account_id: selectedSenderId || undefined }),
    })
    const data = (await res.json().catch(() => ({}))) as { authorize_url?: string; message?: string }
    if (!res.ok || !data.authorize_url) throw new Error(data.message ?? "OAuth start failed.")
    window.location.href = data.authorize_url
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading provider setup…
      </div>
    )
  }

  if (!dashboard) {
    return <p className="text-sm text-destructive">{error ?? "Provider setup unavailable."}</p>
  }

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_LIVE_PROVIDER_SETUP_QA_MARKER}>
      {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {dashboard.env_warnings.length > 0 ? (
        <GrowthEngineCard title="Setup warnings">
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
            {dashboard.env_warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <StatTile label="Readiness pass" value={String(readinessSummary.pass)} tone="healthy" />
        <StatTile label="Warnings" value={String(readinessSummary.warning)} tone="attention" />
        <StatTile label="Blocking checks" value={String(readinessSummary.fail)} tone="critical" />
        <StatTile
          label="Tracking base URL"
          value={dashboard.tracking_base_url ? "Configured" : "Missing"}
          tone={dashboard.tracking_base_url ? "healthy" : "attention"}
        />
      </section>

      <GrowthEngineCard title="Provider Readiness">
        <div className="grid gap-3 md:grid-cols-2">
          {dashboard.families.map((family) => (
            <div key={family.provider_family} className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{family.label}</p>
                  <p className="text-xs text-muted-foreground">{family.oauth_account_email ?? "No account linked"}</p>
                </div>
                <GrowthBadge tone={STATUS_TONE[family.status] ?? "neutral"}>{family.status}</GrowthBadge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {family.cards.slice(0, 4).map((card) => (
                  <div key={card.key} className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    <p className="font-medium">{card.label}</p>
                    <p className="text-muted-foreground">{card.message}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Sender + OAuth" className="overflow-visible" data-qa="growth-sender-select-overlay-fix-v1">
        <div className="relative z-20 mb-4 grid gap-3 overflow-visible md:grid-cols-2">
          <div className="relative z-20 space-y-2 overflow-visible">
            <Label htmlFor="sender-account">Sender account</Label>
            <Select value={selectedSenderId} onValueChange={setSelectedSenderId}>
              <SelectTrigger id="sender-account" className="w-full max-w-full">
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} collisionPadding={8}>
                {senders.map((sender) => (
                  <SelectItem key={sender.id} value={sender.id}>
                    {sender.display_name} ({sender.email_address})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="relative z-0 flex flex-wrap gap-2">
          <Button type="button" disabled={!!actionLoading} onClick={() => runAction("google", () => startOAuth("google"))}>
            {actionLoading === "google" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plug className="mr-2 size-4" />}
            Connect Google
          </Button>
          <Button type="button" variant="outline" disabled={!!actionLoading} onClick={() => runAction("microsoft", () => startOAuth("microsoft"))}>
            Connect Microsoft
          </Button>
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <GrowthEngineCard title="SMTP">
          <div className="space-y-3">
            <Input placeholder="SMTP host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            <Input placeholder="Username" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
            <Input placeholder="Password" type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} />
            <Button
              type="button"
              disabled={!!actionLoading}
              onClick={() =>
                runAction("smtp-save", async () => {
                  const res = await fetch("/api/platform/growth/provider-setup/smtp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      host: smtpHost,
                      username: smtpUser,
                      password: smtpPassword,
                      sender_account_id: selectedSenderId || undefined,
                    }),
                  })
                  if (!res.ok) throw new Error("SMTP save failed.")
                  setSmtpPassword("")
                })
              }
            >
              Save SMTP Credentials
            </Button>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Amazon SES">
          <div className="space-y-3">
            <Input placeholder="Access key ID" value={sesKey} onChange={(e) => setSesKey(e.target.value)} />
            <Input placeholder="Secret access key" type="password" value={sesSecret} onChange={(e) => setSesSecret(e.target.value)} />
            <Input placeholder="Region" value={sesRegion} onChange={(e) => setSesRegion(e.target.value)} />
            <Button
              type="button"
              disabled={!!actionLoading}
              onClick={() =>
                runAction("ses-save", async () => {
                  const res = await fetch("/api/platform/growth/provider-setup/ses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      access_key_id: sesKey,
                      secret_access_key: sesSecret,
                      region: sesRegion,
                      sender_account_id: selectedSenderId || undefined,
                    }),
                  })
                  if (!res.ok) throw new Error("SES save failed.")
                  setSesSecret("")
                })
              }
            >
              Save SES Credentials
            </Button>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Resend">
          <div className="space-y-3">
            <Input placeholder="API key" type="password" value={resendApiKey} onChange={(e) => setResendApiKey(e.target.value)} />
            <Button
              type="button"
              disabled={!!actionLoading}
              onClick={() =>
                runAction("resend-save", async () => {
                  const res = await fetch("/api/platform/growth/provider-setup/resend", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      api_key: resendApiKey,
                      sender_account_id: selectedSenderId || undefined,
                    }),
                  })
                  if (!res.ok) throw new Error("Resend save failed.")
                  setResendApiKey("")
                })
              }
            >
              Save Resend API Key
            </Button>
          </div>
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Webhooks + Test Send">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Webhook URL template: <code className="text-xs">{dashboard.webhook_url_template}</code>
          </p>
          <div className="flex flex-wrap gap-2">
            {(["google", "microsoft", "ses", "resend", "smtp"] as const).map((family) => (
              <Button
                key={family}
                type="button"
                variant="outline"
                size="sm"
                disabled={!!actionLoading}
                onClick={() =>
                  runAction(`webhook-${family}`, async () => {
                    const res = await fetch("/api/platform/growth/provider-setup/webhooks", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ provider_family: family }),
                    })
                    if (!res.ok) throw new Error(`Webhook setup failed for ${family}.`)
                  })
                }
              >
                Configure {family} webhook
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="test-to">Test recipient</Label>
              <Input id="test-to" placeholder="you@company.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={humanApprovalConfirmed} onCheckedChange={(v) => setHumanApprovalConfirmed(v === true)} />
                I confirm this human-approved test send
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["google", "smtp", "ses", "resend"] as const).map((family) => (
              <Button
                key={`test-${family}`}
                type="button"
                variant="secondary"
                size="sm"
                disabled={!!actionLoading}
                onClick={() =>
                  runAction(`test-${family}`, async () => {
                    const conn = await fetch(`/api/platform/growth/provider-setup/${family}/test-connection`, { method: "POST" })
                    if (!conn.ok) throw new Error(`Connection test failed for ${family}.`)
                  })
                }
              >
                <RefreshCw className="mr-2 size-4" />
                Test {family}
              </Button>
            ))}
            <Button
              type="button"
              disabled={!!actionLoading || !humanApprovalConfirmed || !testTo || !selectedSenderId}
              onClick={() =>
                runAction("test-send", async () => {
                  const res = await fetch("/api/platform/growth/provider-setup/smtp/test-send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sender_account_id: selectedSenderId,
                      to: testTo,
                      humanApprovalConfirmed: true,
                    }),
                  })
                  const data = (await res.json().catch(() => ({}))) as { result?: { message?: string } }
                  if (!res.ok) throw new Error(data.result?.message ?? "Test send failed.")
                })
              }
            >
              <Send className="mr-2 size-4" />
              Send Test Email
            </Button>
          </div>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="DNS + Governance">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" />
          <span>Verify DNS in Deliverability Ops before production volume.</span>
          <Button type="button" variant="link" asChild className="h-auto p-0">
            <Link href="/admin/growth/providers/deliverability-ops">Open Deliverability Ops</Link>
          </Button>
          <Button type="button" variant="link" asChild className="h-auto p-0">
            <Link href="/admin/growth/providers/delivery">Open Provider Delivery</Link>
          </Button>
          <Button type="button" variant="link" asChild className="h-auto p-0">
            <Link href="/admin/growth/infrastructure/mailboxes">Mailbox Connections</Link>
          </Button>
        </div>
      </GrowthEngineCard>
    </div>
  )
}
