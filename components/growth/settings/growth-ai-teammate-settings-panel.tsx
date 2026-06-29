"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bot, ExternalLink } from "lucide-react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import {
  GrowthSettingsCard,
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

const UPCOMING_IDENTITY_OPTIONS = [
  { label: "Communication style", description: "Tone and phrasing preferences for AI-assisted outreach." },
  { label: "Avatar", description: "Visual identity shown alongside your AI Teammate." },
  { label: "Voice and working hours", description: "Availability and voice preferences for AI-assisted calls." },
] as const

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
    <div className={GROWTH_SETTINGS_SECTION_GAP} data-qa-section="ai-teammate-settings">
      <GrowthWorkspacePageHeader
        title="AI Teammate"
        description="Name and identity for your AI Teammate. Capabilities do not change when you rename."
        icon={Bot}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={openOnboarding}>
            Replay introduction
          </Button>
        }
      />

      <GrowthAiTeammateProfile teammate={teammate} statusLabel="Working" activityLabel="Available across Growth" />

      <GrowthSettingsCard title="Identity">
        {loading ? <p className="text-sm text-muted-foreground">Loading teammate identity…</p> : null}

        <div className="space-y-2">
          <Label htmlFor="settings-ai-teammate-name">AI name</Label>
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
          {displayError ? <p className="text-sm text-destructive">{displayError}</p> : null}
          {saved ? (
            <p className="text-sm text-emerald-700" role="status" aria-live="polite">
              Saved — Home and AI Operations will use {teammate.name}.
              {serverPersisted ? " Synced to your organization." : null}
            </p>
          ) : null}
          {!serverPersisted && !loading ? (
            <p className="text-sm text-muted-foreground">
              Identity will sync to your organization after the first successful save.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Default · {AI_TEAMMATE_DEFAULT_NAME}. Examples · {AI_TEAMMATE_SUGGESTED_NAMES.join(", ")}.
          </p>
        </div>

        <div className="mt-4 space-y-1 rounded-lg border border-border/60 bg-muted/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
          <p className="font-medium">{AI_TEAMMATE_DEFAULT_ROLE}</p>
          <p className="text-xs text-muted-foreground">Managed by Equipify</p>
        </div>
      </GrowthSettingsCard>

      <GrowthSettingsCard title="Additional identity options">
        <div className="grid gap-3 sm:grid-cols-2">
          {UPCOMING_IDENTITY_OPTIONS.map((option) => (
            <div key={option.label} className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-sm font-medium text-foreground">{option.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">Not available yet</p>
            </div>
          ))}
        </div>
      </GrowthSettingsCard>

      <p className="text-sm text-muted-foreground">
        Copilot tone and autonomy controls live in{" "}
        <Link href="/growth/settings/ai-preferences" className="font-medium text-primary underline-offset-4 hover:underline">
          AI Preferences
          <ExternalLink className="ml-1 inline size-3.5" />
        </Link>
        .
      </p>
    </div>
  )
}
