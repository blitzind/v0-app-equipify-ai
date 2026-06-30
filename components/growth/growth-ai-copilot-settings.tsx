"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, ListChecks, Loader2, PhoneCall, Save, Shield, Sparkles } from "lucide-react"
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

const PROMPT_VARIANT_OPERATOR_LABELS: Record<string, string> = {
  default: "Balanced",
  concise: "Concise",
  executive: "Executive",
}

export function GrowthAiCopilotSettingsPanel({
  variant = "default",
}: {
  variant?: "default" | "operator"
}) {
  const isOperator = variant === "operator"
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
        throw new Error(data.message ?? "Could not load AI preferences.")
      }
      setSettings(data.settings)
      setRules(data.rules ?? [])
      setProviderOk(data.providerHealth?.ok ?? null)
      setRetentionDays(String(data.settings.aiCopilotGenerationRetentionDays))
      setDefaultVariant(String(data.settings.aiCopilotDefaultPromptVariant))
      setPlaybookMaxRules(String(data.settings.aiCopilotPlaybookMaxRulesPerGeneration ?? 12))
      setPlaybookRetentionDays(String(data.settings.aiCopilotPlaybookSourceRetentionDays ?? 30))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load AI preferences.")
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
      setSuccess(isOperator ? "Preferences saved." : "Copilot settings saved.")
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
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {isOperator ? "Loading AI preferences…" : "Loading AI copilot settings…"}
      </div>
    )
  }

  if (!settings) return null

  const statusBadge = isOperator
    ? {
        label: providerOk ? "Ready" : "Needs attention",
        tone: (providerOk ? "healthy" : "attention") as "healthy" | "attention",
      }
    : {
        label: providerOk ? "Provider healthy" : "Provider unavailable",
        tone: (providerOk ? "healthy" : "attention") as "healthy" | "attention",
      }

  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      <GrowthSettingsCard
        title={isOperator ? "Response style" : "Copilot governance"}
        icon={isOperator ? <Sparkles className="size-4" /> : <Shield className="size-4" />}
        headerAside={
          isOperator ? (
            <GrowthSettingsBadge label={statusBadge.label} tone={statusBadge.tone} />
          ) : (
            <GrowthSettingsBadge label={statusBadge.label} tone={statusBadge.tone} />
          )
        }
      >
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          {isOperator ? (
            <p className="text-sm text-muted-foreground">
              Turn AI assist on and choose how your AI teammate responds when drafting outreach and summaries.
            </p>
          ) : null}
          <div className="space-y-2">
            <GrowthSettingsToggleRow
              label={isOperator ? "AI assist enabled" : "AI enabled"}
              checked={settings.aiCopilotEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, aiCopilotEnabled: checked })}
            />
            {!isOperator ? (
              <>
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
              </>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {!isOperator ? (
              <div className={GROWTH_SETTINGS_FORM_GAP}>
                <Label className="text-xs">Generation retention days</Label>
                <Input className="h-9" value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} />
              </div>
            ) : null}
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <Label className="text-xs">{isOperator ? "Response style" : "Default prompt variant"}</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                value={defaultVariant}
                onChange={(event) => setDefaultVariant(event.target.value)}
                aria-label={isOperator ? "Response style" : "Default prompt variant"}
              >
                {GROWTH_AI_COPILOT_PROMPT_VARIANTS.map((variantOption) => (
                  <option key={variantOption} value={variantOption}>
                    {isOperator
                      ? (PROMPT_VARIANT_OPERATOR_LABELS[variantOption] ?? variantOption)
                      : variantOption}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </GrowthSettingsCard>

      {isOperator ? (
        <GrowthSettingsCard title="Draft preferences" icon={<Shield className="size-4" />}>
          <div className={GROWTH_SETTINGS_INNER_GAP}>
            <p className="text-sm text-muted-foreground">
              Control how drafts are saved and when your AI teammate waits for your approval before acting.
            </p>
            <div className="space-y-2">
              <GrowthSettingsToggleRow
                label="Remember past drafts"
                description="Keep recent generations so your AI teammate can learn from context."
                checked={settings.aiCopilotStoreGenerations}
                onCheckedChange={(checked) => setSettings({ ...settings, aiCopilotStoreGenerations: checked })}
              />
              <GrowthSettingsToggleRow
                label="Human approval required"
                description="Outbound actions always wait for your review."
                checked
                disabled
              />
            </div>
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <Label className="text-xs">How long to keep drafts (days)</Label>
              <Input className="h-9" value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)} />
            </div>
          </div>
        </GrowthSettingsCard>
      ) : null}

      <GrowthSettingsCard title={isOperator ? "Call assistance" : "Call assist"} icon={<PhoneCall className="size-4" />}>
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          <p className="text-sm text-muted-foreground">
            {isOperator
              ? "Pre-call briefings, in-call objection help, and post-call summaries in the lead drawer and Calls workspace."
              : "Pre-call briefings, in-call objection help, and post-call summaries in the lead drawer and Calls dashboard."}
          </p>
          {!settings.aiCopilotEnabled ? (
            <p className="rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              {isOperator
                ? "Turn on AI assist above before using call assistance."
                : "Enable Ava above before using call assistance."}
            </p>
          ) : null}
          <div className="space-y-2">
            <GrowthSettingsToggleRow
              label={isOperator ? "Call assistance enabled" : "Call assist enabled"}
              checked={settings.callCopilotEnabled}
              disabled={!settings.aiCopilotEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, callCopilotEnabled: checked })}
            />
            <GrowthSettingsToggleRow
              label={
                isOperator
                  ? "Require summary approval before closing a call"
                  : "Require summary approval before disposition"
              }
              checked={settings.callCopilotRequireSummaryApproval}
              disabled={!settings.callCopilotEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, callCopilotRequireSummaryApproval: checked })
              }
            />
          </div>
          {settings.aiCopilotEnabled && !settings.callCopilotEnabled ? (
            <p className="text-sm text-amber-900 dark:text-amber-100">{GROWTH_CALL_COPILOT_DISABLED_DRAWER_MESSAGE}</p>
          ) : null}
        </div>
      </GrowthSettingsCard>

      <GrowthSettingsCard
        title={isOperator ? "Learning from your playbook" : "Playbook Training"}
        icon={<BookOpen className="size-4" />}
      >
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          {isOperator ? (
            <p className="text-sm text-muted-foreground">
              Apply approved guidance from your playbook when your AI teammate drafts outreach.
            </p>
          ) : null}
          <GrowthSettingsToggleRow
            label={
              isOperator
                ? "Use approved guidance when drafting"
                : "Apply approved playbook rules during generation"
            }
            checked={settings.aiCopilotPlaybookEnabled}
            onCheckedChange={(checked) => setSettings({ ...settings, aiCopilotPlaybookEnabled: checked })}
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <Label className="text-xs">
                {isOperator ? "Guidance rules per draft" : "Max rules per generation"}
              </Label>
              <Input className="h-9" value={playbookMaxRules} onChange={(event) => setPlaybookMaxRules(event.target.value)} />
            </div>
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <Label className="text-xs">
                {isOperator ? "Keep learning sources (days)" : "Source retention days"}
              </Label>
              <Input
                className="h-9"
                value={playbookRetentionDays}
                onChange={(event) => setPlaybookRetentionDays(event.target.value)}
              />
            </div>
          </div>
        </div>
      </GrowthSettingsCard>

      <GrowthSettingsCard title={isOperator ? "Guidance rules" : "Copilot Rules"} icon={<ListChecks className="size-4" />}>
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            {isOperator
              ? "No guidance rules yet. Rules appear here once your workspace playbook is connected."
              : "No copilot rules configured."}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border dark:divide-[#25324C] dark:border-[#25324C]">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{rule.label}</p>
                  {rule.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-1">{rule.description}</p>
                  ) : null}
                </div>
                <Switch
                  checked={rule.enabled}
                  aria-label={`Toggle ${rule.label}`}
                  onCheckedChange={(enabled) => void toggleRule(rule.ruleKey, enabled)}
                />
              </li>
            ))}
          </ul>
        )}
      </GrowthSettingsCard>

      {error ? (
        <p className="text-sm text-rose-600" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status" aria-live="polite">
          {success}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button size="sm" disabled={saving} onClick={() => void saveSettings()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <Save className="mr-2 size-4" aria-hidden />}
          {isOperator ? "Save preferences" : "Save Copilot Settings"}
        </Button>
      </div>
    </div>
  )
}
