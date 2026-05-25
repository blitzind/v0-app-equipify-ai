"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, ListChecks, Loader2, PhoneCall, Save, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_INNER_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
} from "@/components/growth/growth-settings-ui"
import type {
  GrowthAiCopilotRule,
  GrowthCopilotSettings,
} from "@/lib/growth/ai-copilot-types"
import { GROWTH_AI_COPILOT_PROMPT_VARIANTS } from "@/lib/growth/ai-copilot-types"
import { GROWTH_CALL_COPILOT_DISABLED_DRAWER_MESSAGE } from "@/lib/growth/call-copilot-settings"

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
          callCopilotEnabled: settings.callCopilotEnabled,
          callCopilotRequireSummaryApproval: settings.callCopilotRequireSummaryApproval,
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
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      <GrowthSettingsCard
        title="AI Copilot Governance"
        icon={<Shield className="size-4" />}
        headerAside={
          <GrowthSettingsBadge
            label={providerOk ? "Provider healthy" : "Provider unavailable"}
            tone={providerOk ? "healthy" : "attention"}
          />
        }
      >
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          <div className="space-y-2">
            <GrowthSettingsToggleRow
              label="AI enabled"
              checked={settings.aiCopilotEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, aiCopilotEnabled: checked })}
            />
            <GrowthSettingsToggleRow
              label="Store generations"
              checked={settings.aiCopilotStoreGenerations}
              onCheckedChange={(checked) => setSettings({ ...settings, aiCopilotStoreGenerations: checked })}
            />
            <GrowthSettingsToggleRow
              label="Human approval required"
              description="Enforced for all outbound AI actions"
              checked
              disabled
            />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <Label className="text-xs">Generation retention days</Label>
              <Input className="h-9" value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} />
            </div>
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <Label className="text-xs">Default prompt variant</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
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
        </div>
      </GrowthSettingsCard>

      <GrowthSettingsCard title="Call Copilot" icon={<PhoneCall className="size-4" />}>
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          <p className="text-xs text-muted-foreground">
            Pre-call briefings, in-call objection help, and post-call summaries in the lead drawer and Calls dashboard.
          </p>
          {!settings.aiCopilotEnabled ? (
            <p className="rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              Enable AI Copilot above before using Call Copilot.
            </p>
          ) : null}
          <div className="space-y-2">
            <GrowthSettingsToggleRow
              label="Call Copilot enabled"
              checked={settings.callCopilotEnabled}
              disabled={!settings.aiCopilotEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, callCopilotEnabled: checked })}
            />
            <GrowthSettingsToggleRow
              label="Require summary approval before disposition"
              checked={settings.callCopilotRequireSummaryApproval}
              disabled={!settings.callCopilotEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, callCopilotRequireSummaryApproval: checked })
              }
            />
          </div>
          {settings.aiCopilotEnabled && !settings.callCopilotEnabled ? (
            <p className="text-xs text-amber-900 dark:text-amber-100">{GROWTH_CALL_COPILOT_DISABLED_DRAWER_MESSAGE}</p>
          ) : null}
        </div>
      </GrowthSettingsCard>

      <GrowthSettingsCard title="Playbook Training" icon={<BookOpen className="size-4" />}>
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          <GrowthSettingsToggleRow
            label="Apply approved playbook rules during generation"
            checked={settings.aiCopilotPlaybookEnabled}
            onCheckedChange={(checked) => setSettings({ ...settings, aiCopilotPlaybookEnabled: checked })}
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <Label className="text-xs">Max rules per generation</Label>
              <Input className="h-9" value={playbookMaxRules} onChange={(event) => setPlaybookMaxRules(event.target.value)} />
            </div>
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <Label className="text-xs">Source retention days</Label>
              <Input
                className="h-9"
                value={playbookRetentionDays}
                onChange={(event) => setPlaybookRetentionDays(event.target.value)}
              />
            </div>
          </div>
        </div>
      </GrowthSettingsCard>

      <GrowthSettingsCard title="Copilot Rules" icon={<ListChecks className="size-4" />}>
        <ul className="divide-y divide-border rounded-lg border border-border dark:divide-[#25324C] dark:border-[#25324C]">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{rule.label}</p>
                {rule.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-1">{rule.description}</p>
                ) : null}
              </div>
              <Switch checked={rule.enabled} onCheckedChange={(enabled) => void toggleRule(rule.ruleKey, enabled)} />
            </li>
          ))}
        </ul>
      </GrowthSettingsCard>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p> : null}

      <div className="flex justify-end">
        <Button size="sm" disabled={saving} onClick={() => void saveSettings()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          Save Copilot Settings
        </Button>
      </div>
    </div>
  )
}
