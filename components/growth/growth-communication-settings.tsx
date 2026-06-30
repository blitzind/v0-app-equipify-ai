"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  DollarSign,
  Loader2,
  Mail,
  Phone,
  Save,
  Settings2,
} from "lucide-react"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_INNER_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthEmailProviderComparisonList,
  GrowthSettingsBadge,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
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
import { cn } from "@/lib/utils"

const DIAL_MODE_LABELS: Record<GrowthCallDialMode, string> = {
  tel: "Phone app",
  facetime: "FaceTime audio",
  google_voice: "Google Voice",
  custom_url_template: "Custom link",
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

function costSummary(edit: { monthlyCostEstimate: string; seatCount: string; notes: string }): string {
  const parts: string[] = []
  if (edit.monthlyCostEstimate.trim()) parts.push(`$${edit.monthlyCostEstimate}/mo`)
  if (edit.seatCount.trim()) parts.push(`${edit.seatCount} seats`)
  if (edit.notes.trim()) parts.push("Notes")
  return parts.length > 0 ? parts.join(" · ") : "No cost metadata"
}

export type GrowthCommunicationSettingsPanelMode = "operator" | "admin"

export type GrowthCommunicationSettingsPanelProps = {
  /** Operator mode exposes user dial preferences only — platform defaults stay in Platform Admin. */
  mode?: GrowthCommunicationSettingsPanelMode
  /** Calling Preferences page uses operator-focused copy and hides non-dialer fields. */
  variant?: "default" | "calling-preferences"
}

export function GrowthCommunicationSettingsPanel({
  mode = "admin",
  variant = "default",
}: GrowthCommunicationSettingsPanelProps) {
  const isOperatorMode = mode === "operator"
  const isCallingPreferences = isOperatorMode && variant === "calling-preferences"
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [, setPlatform] = useState<GrowthCommunicationSettings | null>(null)
  const [userPrefs, setUserPrefs] = useState<GrowthUserCommunicationPreferences | null>(null)
  const [resolved, setResolved] = useState<ResolvedGrowthDialPreferences | null>(null)
  const [providers, setProviders] = useState<OutboundProviderCapabilities[]>([])
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
      const prefsRes = await fetch("/api/platform/growth/communication-preferences", { cache: "no-store" })
      const prefs = (await prefsRes.json().catch(() => ({}))) as PreferencesPayload

      if (!prefsRes.ok || !prefs.ok || !prefs.platform || !prefs.resolved) {
        throw new Error("Could not load communication preferences.")
      }

      let providerData: ProvidersPayload = { ok: true, providers: [], connections: [] }
      if (!isOperatorMode) {
        const providersRes = await fetch("/api/platform/growth/outbound/providers", { cache: "no-store" })
        providerData = (await providersRes.json().catch(() => ({}))) as ProvidersPayload
        if (!providersRes.ok || !providerData.ok) {
          throw new Error("Could not load provider comparison.")
        }
      } else {
        const providersRes = await fetch("/api/platform/growth/outbound/providers", { cache: "no-store" })
        const connectionsPayload = (await providersRes.json().catch(() => ({}))) as ProvidersPayload
        if (providersRes.ok && connectionsPayload.ok) {
          providerData = { ok: true, providers: [], connections: connectionsPayload.connections ?? [] }
        }
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
  }, [isOperatorMode])

  useEffect(() => {
    void load()
  }, [load])

  async function saveOperatorPreferences() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const userRes = await fetch("/api/platform/growth/communication-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callDialMode: userDialMode ? (userDialMode as GrowthCallDialMode) : null,
          customUrlTemplate: userTemplate.trim() || null,
          showAlternateDialers: userShowAlternates === "" ? null : userShowAlternates === "true",
          preferredEmailConnectionId: userEmailConnectionId || null,
        }),
      })
      const userData = (await userRes.json().catch(() => ({}))) as PreferencesPayload & { message?: string }
      if (!userRes.ok || !userData.ok) {
        throw new Error(userData.message ?? "Could not save call preferences.")
      }

      setSuccess("Call preferences saved.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save call preferences.")
    } finally {
      setSaving(false)
    }
  }

  async function saveSettings() {
    if (isOperatorMode) {
      await saveOperatorPreferences()
      return
    }

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
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading communication settings…
      </div>
    )
  }

  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          aria-live="polite"
        >
          {success}
        </div>
      ) : null}

      <GrowthSettingsCard
        title={isCallingPreferences ? "Dialer" : isOperatorMode ? "Dial preferences" : "Call Channel Preferences"}
        icon={<Phone className="size-4" />}
        headerAside={
          resolved ? (
            <GrowthSettingsBadge
              label={isCallingPreferences ? DIAL_MODE_LABELS[resolved.callDialMode] : `Active: ${DIAL_MODE_LABELS[resolved.callDialMode]}`}
              tone="neutral"
            />
          ) : null
        }
      >
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          <p className="text-sm text-muted-foreground">
            {isCallingPreferences
              ? "Choose how outbound calls open from records. Workspace defaults apply when you leave an override blank."
              : isOperatorMode
                ? "Your dial mode and call sheet behavior. Workspace defaults apply when overrides are blank."
                : "Fallback chain: your preferences → platform defaults → tel. Platform-admin internal only."}
          </p>

          <div className={cn("grid gap-3", isOperatorMode ? "max-w-xl" : "lg:grid-cols-2")}>
            {!isOperatorMode ? (
            <div className="space-y-2.5 rounded-lg border border-border/70 p-3 dark:border-[#25324C]">
              <h4 className="text-sm font-medium">Platform Defaults</h4>
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <Label htmlFor="platform-dial-mode" className="text-xs">
                  Default dial mode
                </Label>
                <select
                  id="platform-dial-mode"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
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
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <Label htmlFor="platform-template" className="text-xs">
                  Custom URL template
                </Label>
                <Input
                  id="platform-template"
                  className="h-9"
                  placeholder="zoomphone://call?number={{phone_e164}}"
                  value={platformTemplate}
                  onChange={(event) => setPlatformTemplate(event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={platformShowAlternates}
                  onChange={(event) => setPlatformShowAlternates(event.target.checked)}
                />
                Show alternate dialers in call sheet
              </label>
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <Label htmlFor="platform-email-connection" className="text-xs">
                  Active email connection
                </Label>
                <select
                  id="platform-email-connection"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
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
            ) : null}

            <div className="space-y-2.5 rounded-lg border border-border/70 p-3 dark:border-[#25324C]">
              <h4 className="text-sm font-medium">{isCallingPreferences ? "Your dialer settings" : "Your preferences"}</h4>
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <Label htmlFor="user-dial-mode" className="text-xs">
                  {isCallingPreferences ? "Default call method" : "Dial mode override"}
                </Label>
                <select
                  id="user-dial-mode"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                  value={userDialMode}
                  onChange={(event) => setUserDialMode(event.target.value)}
                >
                  <option value="">{isCallingPreferences ? "Use workspace default" : "Use platform default"}</option>
                  {GROWTH_CALL_DIAL_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {DIAL_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <Label htmlFor="user-template" className="text-xs">
                  Custom call link
                </Label>
                <Input
                  id="user-template"
                  className="h-9"
                  placeholder="Leave blank to use the workspace template"
                  value={userTemplate}
                  onChange={(event) => setUserTemplate(event.target.value)}
                />
              </div>
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <Label htmlFor="user-show-alternates" className="text-xs">
                  Alternate dialers
                </Label>
                <select
                  id="user-show-alternates"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                  value={userShowAlternates}
                  onChange={(event) => setUserShowAlternates(event.target.value)}
                >
                  <option value="">Use workspace default</option>
                  <option value="true">Show alternates</option>
                  <option value="false">Hide alternates</option>
                </select>
              </div>
              {!isCallingPreferences ? (
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <Label htmlFor="user-email-connection" className="text-xs">
                  Preferred email connection
                </Label>
                <select
                  id="user-email-connection"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
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
              ) : null}
            </div>
          </div>

          {!isCallingPreferences && previewHref ? (
            <p className="text-[11px] text-muted-foreground">
              Preview (555-123-4567): <code className="rounded bg-muted px-1 py-0.5">{previewHref}</code>
            </p>
          ) : null}
        </div>
      </GrowthSettingsCard>

      {!isOperatorMode ? (
      <>
      <GrowthSettingsCard
        title="Email Provider Comparison"
        icon={<Mail className="size-4" />}
        headerAside={
          <Button asChild variant="outline" size="sm" className="h-7 px-2.5 text-xs">
            <Link href="/admin/growth/outreach">
              <Settings2 className="mr-1.5 size-3.5" />
              Outreach Center
            </Link>
          </Button>
        }
      >
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          <p className="text-xs text-muted-foreground">
            Capability metadata only — sample mode until live adapters are connected.
          </p>
          <GrowthEmailProviderComparisonList
            providers={providers}
            connections={connections}
            activeConnectionId={platformEmailConnectionId}
          />
        </div>
      </GrowthSettingsCard>

      <GrowthSettingsCard title="Connection Cost Notes" icon={<DollarSign className="size-4" />}>
        {connections.length === 0 ? (
          <p className="text-xs text-muted-foreground">No provider connections yet.</p>
        ) : (
          <Accordion type="multiple" className="rounded-lg border border-border dark:border-[#25324C]">
            {connections.map((connection) => {
              const edit = connectionEdits[connection.id] ?? { monthlyCostEstimate: "", seatCount: "", notes: "" }
              return (
                <AccordionItem key={connection.id} value={connection.id} className="border-border dark:border-[#25324C]">
                  <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&[data-state=open]>svg]:translate-y-0">
                    <div className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                      <span className="text-sm font-medium">{connection.label}</span>
                      <span className="text-xs font-normal text-muted-foreground">{costSummary(edit)}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Monthly cost estimate (USD)</Label>
                        <Input
                          inputMode="decimal"
                          className="h-9"
                          value={edit.monthlyCostEstimate}
                          onChange={(event) =>
                            setConnectionEdits((prev) => ({
                              ...prev,
                              [connection.id]: { ...edit, monthlyCostEstimate: event.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Seat count</Label>
                        <Input
                          inputMode="numeric"
                          className="h-9"
                          value={edit.seatCount}
                          onChange={(event) =>
                            setConnectionEdits((prev) => ({
                              ...prev,
                              [connection.id]: { ...edit, seatCount: event.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className={cn(GROWTH_SETTINGS_FORM_GAP, "sm:col-span-3")}>
                        <Label className="text-xs">Notes</Label>
                        <Textarea
                          rows={2}
                          className="min-h-[4rem] text-sm"
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
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </GrowthSettingsCard>
      </>
      ) : null}

      <div className="flex justify-end">
        <Button size="sm" disabled={saving} onClick={() => void saveSettings()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          {isCallingPreferences ? "Save dialer settings" : isOperatorMode ? "Save dial preferences" : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}
