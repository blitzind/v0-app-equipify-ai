"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, PhoneCall, RefreshCw, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import {
  VOICE_FOUNDATION_QA_MARKER,
  VOICE_PROVIDER_LABELS,
  type VoiceInfrastructureReadinessSnapshot,
  type VoiceProviderConfigurationRecord,
} from "@/lib/voice/types"

type VoiceSettingsResponse = {
  ok?: boolean
  qaMarker?: string
  schema?: { ready?: boolean; message?: string; probeUncertain?: boolean }
  readiness?: VoiceInfrastructureReadinessSnapshot
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

export function GrowthVoiceInfrastructureSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<VoiceInfrastructureReadinessSnapshot | null>(null)
  const [schemaMessage, setSchemaMessage] = useState<string | null>(null)
  const [schemaReady, setSchemaReady] = useState(false)

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

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

  return (
    <GrowthSettingsCard title="Voice Infrastructure" icon={<PhoneCall className="size-4" />}>
      <div className={GROWTH_SETTINGS_SECTION_GAP} data-qa-marker={VOICE_FOUNDATION_QA_MARKER}>
        <p className="text-sm text-muted-foreground">
          Production telephony foundation — provider readiness, webhook validation, and compliance scaffolding.
          This is infrastructure only; no AI calling or autonomous outbound is enabled in Phase 1A.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading voice infrastructure status…
          </div>
        ) : (
          <>
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
              <p className="font-medium">Schema</p>
              <p className="text-muted-foreground">
                {schemaReady ? "Voice schema probe passed." : schemaMessage ?? "Voice schema status unknown."}
              </p>
            </div>

            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <ShieldCheck className="size-4" />
                Compliance readiness
              </p>
              <p className="text-muted-foreground">{readiness?.complianceReadiness.message}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Configured providers</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                  <RefreshCw className="mr-1 size-3.5" />
                  Refresh
                </Button>
              </div>
              {(readiness?.configuredProviders.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No provider configuration rows yet. Initialize scaffolding to track readiness honestly.
                </p>
              ) : (
                readiness?.configuredProviders.map((provider) => (
                  <ProviderRow key={provider.id} provider={provider} />
                ))
              )}
            </div>

            <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
              Phone number inventory: {readiness?.phoneNumberCount ?? 0} provisioned number(s). Inventory management
              arrives in a later phase.
            </div>

            <p className="text-xs text-muted-foreground">{readiness?.infrastructureMessage}</p>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void initializeProviders()} disabled={initializing}>
                {initializing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                Initialize provider scaffolding
              </Button>
            </div>
          </>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}
      </div>
    </GrowthSettingsCard>
  )
}
