"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Save, Settings2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { resolveGrowthCallHref } from "@/lib/growth/communication/call-dial"
import {
  GROWTH_CALL_DIAL_MODES,
  type GrowthCallDialMode,
  type GrowthCommunicationSettings,
  type GrowthUserCommunicationPreferences,
  type ResolvedGrowthDialPreferences,
} from "@/lib/growth/communication/types"
import type {
  OutboundProviderCapabilities,
  OutboundProviderCapabilityKey,
} from "@/lib/growth/outbound/provider-capabilities"
import type { GrowthEmailProviderConnection } from "@/lib/growth/outbound/types"

const DIAL_MODE_LABELS: Record<GrowthCallDialMode, string> = {
  tel: "Browser tel: link",
  facetime: "FaceTime audio",
  google_voice: "Google Voice (web)",
  custom_url_template: "Custom URL template",
}

const CAPABILITY_TONE: Record<string, string> = {
  supported: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  planned: "bg-slate-100 text-slate-700",
  n_a: "bg-muted text-muted-foreground",
}

type ProvidersPayload = {
  ok?: boolean
  capabilityLabels?: Record<OutboundProviderCapabilityKey, string>
  providers?: OutboundProviderCapabilities[]
  connections?: GrowthEmailProviderConnection[]
}

type PreferencesPayload = {
  ok?: boolean
  platform?: GrowthCommunicationSettings
  user?: GrowthUserCommunicationPreferences | null
  resolved?: ResolvedGrowthDialPreferences
}

export function GrowthCommunicationSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [, setPlatform] = useState<GrowthCommunicationSettings | null>(null)
  const [userPrefs, setUserPrefs] = useState<GrowthUserCommunicationPreferences | null>(null)
  const [resolved, setResolved] = useState<ResolvedGrowthDialPreferences | null>(null)
  const [providers, setProviders] = useState<OutboundProviderCapabilities[]>([])
  const [capabilityLabels, setCapabilityLabels] = useState<Record<OutboundProviderCapabilityKey, string>>({} as Record<OutboundProviderCapabilityKey, string>)
  const [connections, setConnections] = useState<GrowthEmailProviderConnection[]>([])

  const [platformDialMode, setPlatformDialMode] = useState<GrowthCallDialMode>("tel")
  const [platformTemplate, setPlatformTemplate] = useState("")
  const [platformShowAlternates, setPlatformShowAlternates] = useState(false)
  const [platformEmailConnectionId, setPlatformEmailConnectionId] = useState<string>("")

  const [userDialMode, setUserDialMode] = useState<string>("")
  const [userTemplate, setUserTemplate] = useState("")
  const [userShowAlternates, setUserShowAlternates] = useState<string>("")
  const [userEmailConnectionId, setUserEmailConnectionId] = useState<string>("")

  const [connectionEdits, setConnectionEdits] = useState<
    Record<string, { monthlyCostEstimate: string; seatCount: string; notes: string }>
  >({})

  const previewHref = useMemo(() => {
    const mode = (userDialMode || platformDialMode) as GrowthCallDialMode
    const template = userTemplate.trim() || platformTemplate.trim() || null
    return resolveGrowthCallHref("5551234567", mode, template)
  }, [userDialMode, platformDialMode, userTemplate, platformTemplate])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const [prefsRes, providersRes] = await Promise.all([
        fetch("/api/platform/growth/communication-preferences", { cache: "no-store" }),
        fetch("/api/platform/growth/outbound/providers", { cache: "no-store" }),
      ])
      const prefs = (await prefsRes.json().catch(() => ({}))) as PreferencesPayload
      const providerData = (await providersRes.json().catch(() => ({}))) as ProvidersPayload

      if (!prefsRes.ok || !prefs.ok || !prefs.platform || !prefs.resolved) {
        throw new Error("Could not load communication preferences.")
      }
      if (!providersRes.ok || !providerData.ok) {
        throw new Error("Could not load provider comparison.")
      }

      setPlatform(prefs.platform)
      setUserPrefs(prefs.user ?? null)
      setResolved(prefs.resolved)
      setPlatformDialMode(prefs.platform.callDialMode)
      setPlatformTemplate(prefs.platform.customUrlTemplate ?? "")
      setPlatformShowAlternates(prefs.platform.showAlternateDialers)
      setPlatformEmailConnectionId(prefs.platform.activeEmailConnectionId ?? "")

      setUserDialMode(prefs.user?.callDialMode ?? "")
      setUserTemplate(prefs.user?.customUrlTemplate ?? "")
      setUserShowAlternates(
        prefs.user?.showAlternateDialers == null ? "" : prefs.user.showAlternateDialers ? "true" : "false",
      )
      setUserEmailConnectionId(prefs.user?.preferredEmailConnectionId ?? "")

      setProviders(providerData.providers ?? [])
      setCapabilityLabels(providerData.capabilityLabels ?? ({} as Record<OutboundProviderCapabilityKey, string>))
      setConnections(providerData.connections ?? [])

      const edits: Record<string, { monthlyCostEstimate: string; seatCount: string; notes: string }> = {}
      for (const connection of providerData.connections ?? []) {
        edits[connection.id] = {
          monthlyCostEstimate: connection.monthlyCostEstimate != null ? String(connection.monthlyCostEstimate) : "",
          seatCount: connection.seatCount != null ? String(connection.seatCount) : "",
          notes: connection.notes ?? "",
        }
      }
      setConnectionEdits(edits)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveSettings() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const platformRes = await fetch("/api/platform/growth/communication-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callDialMode: platformDialMode,
          customUrlTemplate: platformTemplate.trim() || null,
          showAlternateDialers: platformShowAlternates,
          activeEmailConnectionId: platformEmailConnectionId || null,
        }),
      })
      const platformData = (await platformRes.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!platformRes.ok || !platformData.ok) {
        throw new Error(platformData.message ?? "Could not save platform settings.")
      }

      const userRes = await fetch("/api/platform/growth/communication-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callDialMode: userDialMode ? (userDialMode as GrowthCallDialMode) : null,
          customUrlTemplate: userTemplate.trim() || null,
          showAlternateDialers:
            userShowAlternates === "" ? null : userShowAlternates === "true",
          preferredEmailConnectionId: userEmailConnectionId || null,
        }),
      })
      const userData = (await userRes.json().catch(() => ({}))) as PreferencesPayload & { message?: string }
      if (!userRes.ok || !userData.ok) {
        throw new Error(userData.message ?? "Could not save user preferences.")
      }

      for (const connection of connections) {
        const edit = connectionEdits[connection.id]
        if (!edit) continue
        await fetch(`/api/platform/growth/outbound/connections/${connection.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthlyCostEstimate: edit.monthlyCostEstimate.trim() ? Number(edit.monthlyCostEstimate) : null,
            seatCount: edit.seatCount.trim() ? Number(edit.seatCount) : null,
            notes: edit.notes.trim() || null,
          }),
        })
      }

      setSuccess("Communication settings saved.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading communication settings…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <GrowthEngineCard>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Call channel preferences</h2>
              <p className="text-sm text-muted-foreground">
                Fallback chain: your preferences → platform defaults → tel. Platform-admin internal only — future org add-ons will use org-scoped settings.
              </p>
            </div>
            {resolved ? (
              <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                Active: {DIAL_MODE_LABELS[resolved.callDialMode]}
              </span>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-border p-4">
              <h3 className="font-medium">Platform defaults</h3>
              <div className="space-y-2">
                <Label htmlFor="platform-dial-mode">Default dial mode</Label>
                <select
                  id="platform-dial-mode"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={platformDialMode}
                  onChange={(event) => setPlatformDialMode(event.target.value as GrowthCallDialMode)}
                >
                  {GROWTH_CALL_DIAL_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {DIAL_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform-template">Custom URL template</Label>
                <Input
                  id="platform-template"
                  placeholder="zoomphone://call?number={{phone_e164}}"
                  value={platformTemplate}
                  onChange={(event) => setPlatformTemplate(event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={platformShowAlternates}
                  onChange={(event) => setPlatformShowAlternates(event.target.checked)}
                />
                Show alternate dialers in call sheet
              </label>
              <div className="space-y-2">
                <Label htmlFor="platform-email-connection">Active email connection</Label>
                <select
                  id="platform-email-connection"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={platformEmailConnectionId}
                  onChange={(event) => setPlatformEmailConnectionId(event.target.value)}
                >
                  <option value="">None selected</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.label} ({connection.providerFamily})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-4">
              <h3 className="font-medium">Your overrides</h3>
              <div className="space-y-2">
                <Label htmlFor="user-dial-mode">Dial mode override</Label>
                <select
                  id="user-dial-mode"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={userDialMode}
                  onChange={(event) => setUserDialMode(event.target.value)}
                >
                  <option value="">Use platform default</option>
                  {GROWTH_CALL_DIAL_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {DIAL_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-template">Custom URL template override</Label>
                <Input
                  id="user-template"
                  placeholder="Leave blank to inherit platform template"
                  value={userTemplate}
                  onChange={(event) => setUserTemplate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-show-alternates">Alternate dialers override</Label>
                <select
                  id="user-show-alternates"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={userShowAlternates}
                  onChange={(event) => setUserShowAlternates(event.target.value)}
                >
                  <option value="">Use platform default</option>
                  <option value="true">Show alternates</option>
                  <option value="false">Hide alternates</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email-connection">Preferred email connection</Label>
                <select
                  id="user-email-connection"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={userEmailConnectionId}
                  onChange={(event) => setUserEmailConnectionId(event.target.value)}
                >
                  <option value="">Use platform default</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.label} ({connection.providerFamily})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {previewHref ? (
            <p className="text-xs text-muted-foreground">
              Preview (555-123-4567): <code className="rounded bg-muted px-1 py-0.5">{previewHref}</code>
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Suppression is honored on email outreach. Calls are manual dial only — no auto-dial, recording, or copilot in this slice.
          </p>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Email provider comparison</h2>
              <p className="text-sm text-muted-foreground">
                Capability metadata only — fixture/stub mode until live adapters ship.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/growth/outreach">
                <Settings2 className="mr-2 size-4" />
                Outreach center
              </Link>
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Provider</th>
                  {(Object.keys(capabilityLabels) as OutboundProviderCapabilityKey[]).map((key) => (
                    <th key={key} className="px-2 py-2 text-left font-medium whitespace-nowrap">
                      {capabilityLabels[key] ?? key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {providers.map((provider) => (
                  <tr key={provider.providerFamily}>
                    <td className="px-3 py-3 align-top">
                      <div className="font-medium">{provider.displayName}</div>
                      <div className="text-xs text-muted-foreground">{provider.summary}</div>
                      {provider.fixtureOnly ? (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                          Fixture only
                        </span>
                      ) : null}
                    </td>
                    {(Object.keys(capabilityLabels) as OutboundProviderCapabilityKey[]).map((key) => {
                      const status = provider.capabilities[key]
                      return (
                        <td key={key} className="px-2 py-3 align-top">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${CAPABILITY_TONE[status] ?? ""}`}>
                            {status.replace(/_/g, " ")}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Connection cost notes</h2>
          <div className="space-y-4">
            {connections.map((connection) => {
              const edit = connectionEdits[connection.id] ?? { monthlyCostEstimate: "", seatCount: "", notes: "" }
              return (
                <div key={connection.id} className="rounded-xl border border-border p-4">
                  <div className="mb-3 font-medium">
                    {connection.label}{" "}
                    <span className="text-sm font-normal text-muted-foreground">({connection.providerFamily})</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Monthly cost estimate (USD)</Label>
                      <Input
                        inputMode="decimal"
                        value={edit.monthlyCostEstimate}
                        onChange={(event) =>
                          setConnectionEdits((prev) => ({
                            ...prev,
                            [connection.id]: { ...edit, monthlyCostEstimate: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Seat count</Label>
                      <Input
                        inputMode="numeric"
                        value={edit.seatCount}
                        onChange={(event) =>
                          setConnectionEdits((prev) => ({
                            ...prev,
                            [connection.id]: { ...edit, seatCount: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <Label>Notes</Label>
                      <Textarea
                        rows={2}
                        value={edit.notes}
                        onChange={(event) =>
                          setConnectionEdits((prev) => ({
                            ...prev,
                            [connection.id]: { ...edit, notes: event.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </GrowthEngineCard>

      <div className="flex justify-end">
        <Button disabled={saving} onClick={() => void saveSettings()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          Save settings
        </Button>
      </div>
    </div>
  )
}
