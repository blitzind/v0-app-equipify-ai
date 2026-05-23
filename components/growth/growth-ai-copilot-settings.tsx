"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type {
  GrowthAiCopilotRule,
  GrowthCopilotSettings,
} from "@/lib/growth/ai-copilot-types"
import { GROWTH_AI_COPILOT_PROMPT_VARIANTS } from "@/lib/growth/ai-copilot-types"

export function GrowthAiCopilotSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [settings, setSettings] = useState<GrowthCopilotSettings | null>(null)
  const [rules, setRules] = useState<GrowthAiCopilotRule[]>([])
  const [providerOk, setProviderOk] = useState<boolean | null>(null)
  const [retentionDays, setRetentionDays] = useState("90")
  const [defaultVariant, setDefaultVariant] = useState("default")
  const [playbookMaxRules, setPlaybookMaxRules] = useState("12")
  const [playbookRetentionDays, setPlaybookRetentionDays] = useState("30")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/copilot/settings", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: GrowthCopilotSettings
        rules?: GrowthAiCopilotRule[]
        providerHealth?: { ok: boolean }
        message?: string
      }
      if (!res.ok || !data.ok || !data.settings) {
        throw new Error(data.message ?? "Could not load copilot settings.")
      }
      setSettings(data.settings)
      setRules(data.rules ?? [])
      setProviderOk(data.providerHealth?.ok ?? null)
      setRetentionDays(String(data.settings.aiCopilotGenerationRetentionDays))
      setDefaultVariant(String(data.settings.aiCopilotDefaultPromptVariant))
      setPlaybookMaxRules(String(data.settings.aiCopilotPlaybookMaxRulesPerGeneration ?? 12))
      setPlaybookRetentionDays(String(data.settings.aiCopilotPlaybookSourceRetentionDays ?? 30))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/platform/growth/copilot/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiCopilotEnabled: settings.aiCopilotEnabled,
          aiCopilotStoreGenerations: settings.aiCopilotStoreGenerations,
          aiCopilotGenerationRetentionDays: Number(retentionDays),
          aiCopilotDefaultPromptVariant: defaultVariant,
          aiCopilotPlaybookEnabled: settings.aiCopilotPlaybookEnabled,
          aiCopilotPlaybookMaxRulesPerGeneration: Number(playbookMaxRules),
          aiCopilotPlaybookSourceRetentionDays: Number(playbookRetentionDays),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; settings?: GrowthCopilotSettings; message?: string }
      if (!res.ok || !data.ok || !data.settings) throw new Error(data.message ?? "Save failed.")
      setSettings(data.settings)
      setSuccess("Copilot settings saved.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleRule(ruleKey: string, enabled: boolean) {
    const res = await fetch("/api/platform/growth/copilot/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleKey, enabled }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; rule?: GrowthAiCopilotRule }
    if (data.rule) {
      setRules((prev) => prev.map((entry) => (entry.ruleKey === ruleKey ? data.rule! : entry)))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading AI copilot settings…
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="space-y-6">
      <GrowthEngineCard title="AI Copilot governance">
        <div className="mb-4 flex flex-wrap gap-2">
          <GrowthBadge
            label={providerOk ? "AI provider healthy" : "AI provider unavailable"}
            tone={providerOk ? "healthy" : "warning"}
          />
          <GrowthBadge label="Human approval required" tone="warning" />
          <GrowthBadge label="No auto-send" tone="neutral" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.aiCopilotEnabled}
              onChange={(event) => setSettings({ ...settings, aiCopilotEnabled: event.target.checked })}
            />
            AI enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.aiCopilotStoreGenerations}
              onChange={(event) => setSettings({ ...settings, aiCopilotStoreGenerations: event.target.checked })}
            />
            Store generations
          </label>
          <label className="flex items-center gap-2 text-sm opacity-70">
            <input type="checkbox" checked disabled readOnly />
            Human approval required (enforced)
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Generation retention days</Label>
            <Input value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Default prompt variant</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={defaultVariant}
              onChange={(event) => setDefaultVariant(event.target.value)}
            >
              {GROWTH_AI_COPILOT_PROMPT_VARIANTS.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Playbook training">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.aiCopilotPlaybookEnabled}
              onChange={(event) => setSettings({ ...settings, aiCopilotPlaybookEnabled: event.target.checked })}
            />
            Apply approved playbook rules during generation
          </label>
          <div className="space-y-1">
            <Label>Max rules per generation</Label>
            <Input value={playbookMaxRules} onChange={(event) => setPlaybookMaxRules(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Source retention days</Label>
            <Input value={playbookRetentionDays} onChange={(event) => setPlaybookRetentionDays(event.target.value)} />
          </div>
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Copilot rules">
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{rule.label}</p>
                {rule.description ? <p className="text-muted-foreground">{rule.description}</p> : null}
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => void toggleRule(rule.ruleKey, event.target.checked)}
                />
                Enabled
              </label>
            </li>
          ))}
        </ul>
      </GrowthEngineCard>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      <div className="flex justify-end">
        <Button disabled={saving} onClick={() => void saveSettings()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          Save copilot settings
        </Button>
      </div>
    </div>
  )
}
