"use client"

import { useCallback, useEffect, useState } from "react"
import { Clock3, Loader2, Phone, PhoneCall, RefreshCw, Route, ShieldCheck, Voicemail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import {
  VOICE_FOUNDATION_QA_MARKER,
  VOICE_OPERATIONS_QA_MARKER,
  VOICE_PROVIDER_LABELS,
  VOICE_ROUTING_MODE_LABELS,
  type VoiceBusinessHoursRecord,
  type VoiceNumberListItem,
  type VoiceOperationsReadinessSnapshot,
  type VoiceProviderConfigurationRecord,
  type VoiceRoutingProfileRecord,
  type VoiceVoicemailBoxRecord,
} from "@/lib/voice/types"

type VoiceSettingsResponse = {
  ok?: boolean
  qaMarker?: string
  operationsQaMarker?: string
  schema?: { ready?: boolean; message?: string; probeUncertain?: boolean }
  readiness?: VoiceOperationsReadinessSnapshot
  message?: string
}

function ProviderRow({ provider }: { provider: VoiceProviderConfigurationRecord }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
      <div>
        <p className="font-medium">{VOICE_PROVIDER_LABELS[provider.provider] ?? provider.provider}</p>
        <p className="text-xs text-muted-foreground">
          Status: {provider.status} · Voice {provider.voiceEnabled ? "enabled" : "disabled"} · SMS{" "}
          {provider.smsEnabled ? "enabled" : "disabled"}
        </p>
      </div>
      <div className="text-xs text-muted-foreground">
        Webhook {provider.webhookValidated ? "validated" : "not validated"}
        {provider.lastValidationAt ? ` · ${new Date(provider.lastValidationAt).toLocaleString()}` : ""}
      </div>
    </div>
  )
}

function NumberRow({
  number,
  onSave,
}: {
  number: VoiceNumberListItem
  onSave: (id: string, patch: { displayName?: string; defaultForwardingTarget?: string; status?: string }) => Promise<void>
}) {
  const [displayName, setDisplayName] = useState(number.displayName)
  const [forwarding, setForwarding] = useState(number.defaultForwardingTarget)
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-2 rounded-md border border-border/60 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{number.phoneNumber}</p>
          <p className="text-xs text-muted-foreground">
            {VOICE_PROVIDER_LABELS[number.provider]} · {number.status} · {number.routingModeLabel} · Hours:{" "}
            {number.businessHoursStatusLabel}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Voice {number.voiceEnabled ? "on" : "off"} · SMS {number.smsEnabled ? "on" : "off"}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label htmlFor={`display-${number.id}`}>Display name</Label>
          <Input id={`display-${number.id}`} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`forward-${number.id}`}>Default forwarding target</Label>
          <Input id={`forward-${number.id}`} value={forwarding} onChange={(e) => setForwarding(e.target.value)} />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={saving}
        onClick={() => {
          setSaving(true)
          void onSave(number.id, { displayName, defaultForwardingTarget: forwarding }).finally(() => setSaving(false))
        }}
      >
        {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
        Save number settings
      </Button>
    </div>
  )
}

export function GrowthVoiceInfrastructureSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<VoiceOperationsReadinessSnapshot | null>(null)
  const [schemaMessage, setSchemaMessage] = useState<string | null>(null)
  const [schemaReady, setSchemaReady] = useState(false)
  const [numbers, setNumbers] = useState<VoiceNumberListItem[]>([])
  const [routingProfiles, setRoutingProfiles] = useState<VoiceRoutingProfileRecord[]>([])
  const [businessHours, setBusinessHours] = useState<VoiceBusinessHoursRecord[]>([])
  const [voicemailBoxes, setVoicemailBoxes] = useState<VoiceVoicemailBoxRecord[]>([])
  const [newProfileName, setNewProfileName] = useState("")
  const [newHoursName, setNewHoursName] = useState("")
  const [newVoicemailName, setNewVoicemailName] = useState("")

  const loadOperations = useCallback(async () => {
    const [numbersRes, profilesRes, hoursRes, boxesRes] = await Promise.all([
      fetch("/api/platform/growth/voice/numbers", { cache: "no-store" }),
      fetch("/api/platform/growth/voice/routing-profiles", { cache: "no-store" }),
      fetch("/api/platform/growth/voice/business-hours", { cache: "no-store" }),
      fetch("/api/platform/growth/voice/voicemail-boxes", { cache: "no-store" }),
    ])
    const numbersData = (await numbersRes.json().catch(() => ({}))) as { numbers?: VoiceNumberListItem[] }
    const profilesData = (await profilesRes.json().catch(() => ({}))) as { profiles?: VoiceRoutingProfileRecord[] }
    const hoursData = (await hoursRes.json().catch(() => ({}))) as { businessHours?: VoiceBusinessHoursRecord[] }
    const boxesData = (await boxesRes.json().catch(() => ({}))) as { voicemailBoxes?: VoiceVoicemailBoxRecord[] }
    if (numbersRes.ok) setNumbers(numbersData.numbers ?? [])
    if (profilesRes.ok) setRoutingProfiles(profilesData.profiles ?? [])
    if (hoursRes.ok) setBusinessHours(hoursData.businessHours ?? [])
    if (boxesRes.ok) setVoicemailBoxes(boxesData.voicemailBoxes ?? [])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/voice/settings", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as VoiceSettingsResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load voice infrastructure settings.")
      setReadiness(data.readiness ?? null)
      setSchemaReady(Boolean(data.schema?.ready))
      setSchemaMessage(data.schema?.message ?? null)
      await loadOperations()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [loadOperations])

  useEffect(() => {
    void load()
  }, [load])

  async function initializeProviders() {
    setInitializing(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/platform/growth/voice/settings", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as VoiceSettingsResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not initialize voice providers.")
      setReadiness(data.readiness ?? null)
      setSuccess(data.message ?? "Voice provider rows initialized.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Initialize failed.")
    } finally {
      setInitializing(false)
    }
  }

  async function saveNumber(
    id: string,
    patch: { displayName?: string; defaultForwardingTarget?: string; status?: string },
  ) {
    const res = await fetch(`/api/platform/growth/voice/numbers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error("Could not update number.")
    await loadOperations()
    setSuccess("Number settings saved.")
  }

  async function createRoutingProfile() {
    if (!newProfileName.trim()) return
    const res = await fetch("/api/platform/growth/voice/routing-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProfileName.trim(), routingMode: "assigned_user" }),
    })
    if (!res.ok) throw new Error("Could not create routing profile.")
    setNewProfileName("")
    await loadOperations()
    setSuccess("Routing profile created.")
  }

  async function createBusinessHours() {
    if (!newHoursName.trim()) return
    const res = await fetch("/api/platform/growth/voice/business-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newHoursName.trim() }),
    })
    if (!res.ok) throw new Error("Could not create business hours profile.")
    setNewHoursName("")
    await loadOperations()
    setSuccess("Business hours profile created.")
  }

  async function createVoicemailBox() {
    if (!newVoicemailName.trim()) return
    const res = await fetch("/api/platform/growth/voice/voicemail-boxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newVoicemailName.trim() }),
    })
    if (!res.ok) throw new Error("Could not create voicemail box.")
    setNewVoicemailName("")
    await loadOperations()
    setSuccess("Voicemail box created.")
  }

  const compliance = readiness?.complianceReadinessExtended

  return (
    <GrowthSettingsCard title="Voice Infrastructure" icon={<PhoneCall className="size-4" />}>
      <div
        className={GROWTH_SETTINGS_SECTION_GAP}
        data-qa-marker={`${VOICE_FOUNDATION_QA_MARKER} ${VOICE_OPERATIONS_QA_MARKER}`}
      >
        <p className="text-sm text-muted-foreground">
          Voice operations layer — number inventory, routing profiles, business hours, and voicemail scaffolding.
          Operator controlled only; no AI calling, voicemail drops, or autonomous outreach in this phase.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading voice operations…
          </div>
        ) : (
          <>
            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="text-sm font-medium">Provider readiness</p>
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <p className="font-medium">Schema</p>
                <p className="text-muted-foreground">
                  {schemaReady ? "Voice schema probe passed." : schemaMessage ?? "Voice schema status unknown."}
                </p>
              </div>
              {(readiness?.configuredProviders.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No provider configuration rows yet.</p>
              ) : (
                readiness?.configuredProviders.map((provider) => <ProviderRow key={provider.id} provider={provider} />)
              )}
              <Button type="button" size="sm" onClick={() => void initializeProviders()} disabled={initializing}>
                {initializing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                Initialize provider scaffolding
              </Button>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Phone className="size-4" />
                Numbers
              </p>
              <p className="text-xs text-muted-foreground">
                Number provisioning will be connected after provider credentials are fully validated.
              </p>
              {numbers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No voice numbers in inventory yet.</p>
              ) : (
                numbers.map((number) => (
                  <NumberRow
                    key={number.id}
                    number={number}
                    onSave={async (id, patch) => {
                      try {
                        await saveNumber(id, patch)
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Save failed.")
                      }
                    }}
                  />
                ))
              )}
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Route className="size-4" />
                Routing profiles
              </p>
              {routingProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No routing profiles yet.</p>
              ) : (
                routingProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                    <p className="font-medium">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {VOICE_ROUTING_MODE_LABELS[profile.routingMode]} · Fallback:{" "}
                      {VOICE_ROUTING_MODE_LABELS[profile.fallbackMode]}
                    </p>
                  </div>
                ))
              )}
              <div className={`flex flex-wrap items-end ${GROWTH_SETTINGS_FORM_GAP}`}>
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor="new-routing-profile">New profile name</Label>
                  <Input
                    id="new-routing-profile"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Main inbound routing"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void createRoutingProfile().catch((e) =>
                      setError(e instanceof Error ? e.message : "Create failed."),
                    )
                  }}
                >
                  Create routing profile
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {VOICE_ROUTING_MODE_LABELS.ai_receptionist_future} — disabled in Phase 1B.
              </p>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Clock3 className="size-4" />
                Business hours
              </p>
              {businessHours.length === 0 ? (
                <p className="text-sm text-muted-foreground">No business hours profiles yet.</p>
              ) : (
                businessHours.map((hours) => (
                  <div key={hours.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                    <p className="font-medium">{hours.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Timezone: {hours.timezone} · After hours:{" "}
                      {VOICE_ROUTING_MODE_LABELS[hours.afterHoursRoutingMode]}
                    </p>
                  </div>
                ))
              )}
              <div className={`flex flex-wrap items-end ${GROWTH_SETTINGS_FORM_GAP}`}>
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor="new-business-hours">New schedule name</Label>
                  <Input
                    id="new-business-hours"
                    value={newHoursName}
                    onChange={(e) => setNewHoursName(e.target.value)}
                    placeholder="Standard business hours"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void createBusinessHours().catch((e) =>
                      setError(e instanceof Error ? e.message : "Create failed."),
                    )
                  }}
                >
                  Create business hours
                </Button>
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Voicemail className="size-4" />
                Voicemail boxes
              </p>
              {voicemailBoxes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No voicemail boxes yet.</p>
              ) : (
                voicemailBoxes.map((box) => (
                  <div key={box.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                    <p className="font-medium">{box.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Retention: {box.retentionDays} days · No AI greeting generation in Phase 1B.
                    </p>
                  </div>
                ))
              )}
              <div className={`flex flex-wrap items-end ${GROWTH_SETTINGS_FORM_GAP}`}>
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor="new-voicemail-box">New voicemail box</Label>
                  <Input
                    id="new-voicemail-box"
                    value={newVoicemailName}
                    onChange={(e) => setNewVoicemailName(e.target.value)}
                    placeholder="Main inbox voicemail"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void createVoicemailBox().catch((e) =>
                      setError(e instanceof Error ? e.message : "Create failed."),
                    )
                  }}
                >
                  Create voicemail box
                </Button>
              </div>
            </section>

            <section className={GROWTH_SETTINGS_SECTION_GAP}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4" />
                Compliance readiness
              </p>
              <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                <p>Opt-out registry: {compliance?.optOutTableReady ? "table ready" : "pending"} ({compliance?.optOutCount ?? 0} records)</p>
                <p>{compliance?.dncEnforcementMessage}</p>
                <p>{compliance?.callRecordingDisclosureMessage}</p>
                <p>{compliance?.aiDisclosureMessage}</p>
              </div>
            </section>

            <p className="text-xs text-muted-foreground">{readiness?.infrastructureMessage}</p>

            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-1 size-3.5" />
              Refresh all
            </Button>
          </>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}
      </div>
    </GrowthSettingsCard>
  )
}
