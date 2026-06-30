"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { Bot, ExternalLink, Sparkles } from "lucide-react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { GrowthAiSettingsReadinessSummary } from "@/components/growth/settings/growth-ai-settings-readiness-summary"
import {
  GrowthSettingsCard,
  GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  AI_TEAMMATE_DEFAULT_ROLE,
  AI_TEAMMATE_NAME_MAX_LENGTH,
  AI_TEAMMATE_NAME_MIN_LENGTH,
  AI_TEAMMATE_SUGGESTED_NAMES,
  isValidAiTeammateName,
  normalizeAiTeammateName,
} from "@/lib/workspace/ai-teammate-identity"
import { GrowthAiTeammateProfile } from "@/components/growth/ai-teammate/growth-ai-teammate-profile"

export const GROWTH_SETTINGS_AI_TEAMMATE_PAGE_QA_MARKER = "growth-settings-ai-teammate-wiring-1a-v1" as const

const UPCOMING_IDENTITY_OPTIONS = [
  { label: "Communication style", description: "Tone and phrasing preferences for AI-assisted outreach." },
  { label: "Avatar", description: "Visual identity shown alongside your AI teammate." },
  { label: "Voice and working hours", description: "Availability and voice preferences for AI-assisted calls." },
] as const

function AiTeammateSettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const sectionId = `ai-teammate-section-${title.replace(/\s+/g, "-").toLowerCase()}`
  return (
    <section className="space-y-3" aria-labelledby={sectionId}>
      <div>
        <h2 id={sectionId} className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function GrowthAiTeammateSettingsPanel() {
  const { teammate, setTeammateName, openOnboarding, loading, saving, error, serverPersisted } =
    useAiTeammateIdentity()
  const [draftName, setDraftName] = useState(teammate.name)
  const [saved, setSaved] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setDraftName(teammate.name)
  }, [teammate.name])

  async function handleSave() {
    setLocalError(null)
    setSaved(false)
    const ok = await setTeammateName(draftName)
    if (!ok) {
      setLocalError(`Enter a name between ${AI_TEAMMATE_NAME_MIN_LENGTH} and ${AI_TEAMMATE_NAME_MAX_LENGTH} characters.`)
      return
    }
    if (!isValidAiTeammateName(normalizeAiTeammateName(draftName))) {
      setLocalError(`Enter a name between ${AI_TEAMMATE_NAME_MIN_LENGTH} and ${AI_TEAMMATE_NAME_MAX_LENGTH} characters.`)
      return
    }
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  const displayError = localError ?? error

  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-section="ai-teammate-settings"
      data-qa-marker={GROWTH_SETTINGS_AI_TEAMMATE_PAGE_QA_MARKER}
      data-growth-settings-ai-refinement={GROWTH_SETTINGS_AI_REFINEMENT_2F_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="AI Teammate"
        description="How your AI teammate works for you — personality, communication, and guidance."
        icon={Bot}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={openOnboarding}>
            Replay introduction
          </Button>
        }
      />

      <GrowthAiSettingsReadinessSummary scope="teammate" />

      <AiTeammateSettingsSection title="Personality" description="Name and profile shown across Growth.">
        <GrowthAiTeammateProfile teammate={teammate} statusLabel="Ready" activityLabel="Available across Growth" />

        <GrowthSettingsCard title="Name and role">
          {loading ? <p className="text-sm text-muted-foreground">Loading teammate identity…</p> : null}

          <div className="space-y-2">
            <Label htmlFor="settings-ai-teammate-name">Display name</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                id="settings-ai-teammate-name"
                value={draftName}
                disabled={loading || saving}
                onChange={(event) => {
                  setDraftName(event.target.value)
                  setLocalError(null)
                  setSaved(false)
                }}
                placeholder={AI_TEAMMATE_DEFAULT_NAME}
              />
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={loading || saving || normalizeAiTeammateName(draftName) === teammate.name}
              >
                {saving ? "Saving…" : "Save name"}
              </Button>
            </div>
            {displayError ? (
              <p className="text-sm text-destructive" role="alert">
                {displayError}
              </p>
            ) : null}
            {saved ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status" aria-live="polite">
                Saved — Home and your workspace will use {teammate.name}.
                {serverPersisted ? " Synced to your organization." : null}
              </p>
            ) : null}
            {!serverPersisted && !loading ? (
              <p className="text-sm text-muted-foreground">
                Identity syncs to your organization after the first successful save.
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Default · {AI_TEAMMATE_DEFAULT_NAME}. Examples · {AI_TEAMMATE_SUGGESTED_NAMES.join(", ")}.
            </p>
          </div>

          <div className="mt-4 space-y-1 rounded-lg border border-dashed border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
            <p className="font-medium">{AI_TEAMMATE_DEFAULT_ROLE}</p>
            <p className="text-xs text-muted-foreground">Managed by Equipify</p>
          </div>
        </GrowthSettingsCard>
      </AiTeammateSettingsSection>

      <AiTeammateSettingsSection
        title="Communication style"
        description="Tone, avatar, and availability preferences for your AI teammate."
      >
        <GrowthSettingsCard title="Style and presence">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {UPCOMING_IDENTITY_OPTIONS.map((option) => (
              <div
                key={option.label}
                className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3"
              >
                <p className="text-sm font-medium text-foreground">{option.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">Currently unavailable</p>
              </div>
            ))}
          </div>
        </GrowthSettingsCard>
      </AiTeammateSettingsSection>

      <AiTeammateSettingsSection title="Guidance" description="How your AI teammate drafts, learns, and assists.">
        <GrowthSettingsCard title="Preferences and autonomy" icon={<Sparkles className="size-4" />}>
          <p className="text-sm text-muted-foreground">
            Response style, draft preferences, memory, and what your AI teammate can do automatically live in
            dedicated settings pages.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/growth/settings/ai-preferences">
                AI Preferences
                <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/growth/settings/autonomy">
                Growth Autonomy
                <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        </GrowthSettingsCard>
      </AiTeammateSettingsSection>
    </div>
  )
}
