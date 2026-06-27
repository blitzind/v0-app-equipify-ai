"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bot, ExternalLink } from "lucide-react"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
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
    <div className="space-y-6" data-qa-section="ai-teammate-settings">
      <GrowthWorkspacePageHeader
        title="AI Teammate"
        description="Your named AI teammate inside AI OS — identity and presentation only. Capabilities do not change when you rename."
        icon={Bot}
        iconClassName="bg-indigo-50 text-indigo-700"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={openOnboarding}>
            Replay introduction
          </Button>
        }
      />

      <GrowthAiTeammateProfile teammate={teammate} statusLabel="Working" activityLabel="Available across AI OS" />

      <section className="rounded-xl border border-border/70 bg-card p-6 shadow-sm space-y-6">
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
            <p className="text-sm text-emerald-700">
              Saved — Home and AI Operations will use {teammate.name}.
              {serverPersisted ? " Synced to your organization." : null}
            </p>
          ) : null}
          {!serverPersisted && !loading ? (
            <p className="text-sm text-muted-foreground">
              Using local fallback until server identity is saved for your organization.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Default · {AI_TEAMMATE_DEFAULT_NAME}. Examples · {AI_TEAMMATE_SUGGESTED_NAMES.join(", ")}.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</p>
            <p className="font-medium">{AI_TEAMMATE_DEFAULT_ROLE}</p>
            <p className="text-xs text-muted-foreground">System-controlled · expands to business operator over time</p>
          </div>
          <div className="space-y-1 rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 opacity-80">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Communication style</p>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
          <div className="space-y-1 rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 opacity-80">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avatar</p>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
          <div className="space-y-1 rounded-lg border border-dashed border-border/60 bg-muted/10 p-4 opacity-80">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Voice · Working hours</p>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Platform branding remains{" "}
        <Link href="/growth/settings/ai-preferences" className="font-medium text-primary underline-offset-4 hover:underline">
          AI OS Settings
          <ExternalLink className="ml-1 inline size-3.5" />
        </Link>{" "}
        for copilot and autonomy controls.
      </p>
    </div>
  )
}
