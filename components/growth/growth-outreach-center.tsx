"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Mail, Radio } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  GrowthEmailProviderConnection,
  GrowthOutboundCampaign,
  GrowthOutboundContact,
  GrowthOutboundMessage,
  GrowthOutboundReply,
  GrowthProviderWebhook,
  GrowthSuppressionEntry,
} from "@/lib/growth/outbound/types"

type GrowthOutreachCenterProps = {
  onProcessFixture?: () => void
}

export function GrowthOutreachCenter({ onProcessFixture }: GrowthOutreachCenterProps) {
  const [connections, setConnections] = useState<GrowthEmailProviderConnection[]>([])
  const [webhooks, setWebhooks] = useState<GrowthProviderWebhook[]>([])
  const [suppression, setSuppression] = useState<GrowthSuppressionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkLeadId, setLinkLeadId] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [connRes, webhookRes, supRes] = await Promise.all([
        fetch("/api/platform/growth/outbound/connections", { cache: "no-store" }),
        fetch("/api/platform/growth/outbound/webhooks", { cache: "no-store" }),
        fetch("/api/platform/growth/suppression", { cache: "no-store" }),
      ])
      const connData = (await connRes.json()) as { ok?: boolean; connections?: GrowthEmailProviderConnection[] }
      const webhookData = (await webhookRes.json()) as { ok?: boolean; webhooks?: GrowthProviderWebhook[] }
      const supData = (await supRes.json()) as { ok?: boolean; entries?: GrowthSuppressionEntry[] }
      setConnections(connData.connections ?? [])
      setWebhooks(webhookData.webhooks ?? [])
      setSuppression(supData.entries ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load outreach center.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function processFixture(fixtureId: string) {
    setWorking(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/outbound/fixtures/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId }),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string; result?: { unresolved?: boolean } }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Fixture processing failed.")
      onProcessFixture?.()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fixture processing failed.")
    } finally {
      setWorking(false)
    }
  }

  async function linkWebhook(webhookId: string) {
    const leadId = linkLeadId[webhookId]?.trim()
    if (!leadId) return
    setWorking(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/outbound/webhooks/${webhookId}/link-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Link failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed.")
    } finally {
      setWorking(false)
    }
  }

  const connection = connections[0]

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Radio size={17} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Provider connection</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sample provider — no live EmailBison account connected yet.
            </p>
          </div>
        </div>
        {loading ? (
          <div className="mt-4 flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading connection…
          </div>
        ) : connection ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Label" value={connection.label} />
            <Metric label="Provider" value={connection.provider} />
            <Metric label="Family" value={connection.providerFamily} />
            <Metric label="Status" value={connection.status} />
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No outbound connection configured.</p>
        )}
        <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Webhook URL (future): <code>/api/platform/growth/webhooks/outbound/stub</code>
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Sample event processor</h3>
        <p className="mt-1 text-sm text-muted-foreground">Process sample outbound events against leads with matching emails.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["sent-001", "replied-interested-001", "replied-ooo-001", "unsubscribed-001", "unmatched-email-001"].map(
            (fixtureId) => (
              <button
                key={fixtureId}
                type="button"
                disabled={working}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/40 disabled:opacity-50"
                onClick={() => void processFixture(fixtureId)}
              >
                {fixtureId}
              </button>
            ),
          )}
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-semibold">Unresolved webhooks</h3>
        </div>
        {webhooks.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">No unresolved webhook events.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Received</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Link lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {webhooks.map((webhook) => {
                  const email =
                    typeof webhook.payload.contact === "object" &&
                    webhook.payload.contact &&
                    "email" in (webhook.payload.contact as object)
                      ? String((webhook.payload.contact as { email?: string }).email ?? "—")
                      : "—"
                  return (
                    <tr key={webhook.id}>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(webhook.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{webhook.provider}</td>
                      <td className="px-4 py-3">{email}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <input
                            className="w-48 rounded-md border border-border bg-background px-2 py-1 text-xs"
                            placeholder="Lead UUID"
                            value={linkLeadId[webhook.id] ?? ""}
                            onChange={(e) => setLinkLeadId((prev) => ({ ...prev, [webhook.id]: e.target.value }))}
                          />
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted/40"
                            disabled={working}
                            onClick={() => void linkWebhook(webhook.id)}
                          >
                            Link
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <h3 className="font-semibold">Suppression list</h3>
        </div>
        {suppression.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">No suppressed emails yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppression.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3">{entry.email}</td>
                    <td className="px-4 py-3 capitalize">{entry.reason.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">{entry.source.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(entry.suppressedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold capitalize">{value}</dd>
    </div>
  )
}

export type GrowthLeadOutboundData = {
  contacts: GrowthOutboundContact[]
  messages: GrowthOutboundMessage[]
  replies: GrowthOutboundReply[]
  campaigns: GrowthOutboundCampaign[]
}
