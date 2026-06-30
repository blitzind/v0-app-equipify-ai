"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  GrowthSettingsCard,
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import {
  GrowthSettingsField,
  GrowthSettingsSaveStatus,
  GrowthSettingsSectionErrorState,
  GrowthSettingsSectionForm,
  GrowthSettingsSectionLoadingState,
} from "@/components/growth/settings/growth-settings-section-form-state"
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useGrowthWorkspaceSettingsResource } from "@/hooks/growth/use-growth-workspace-settings-resource"
import {
  GROWTH_WORKSPACE_SETTINGS_TIMEZONE_OPTIONS,
  resolveGrowthWorkspaceTimezoneLabel,
} from "@/lib/growth/settings/growth-workspace-settings-options"
import type { GrowthWorkspaceSettingsProfile } from "@/lib/growth/settings/growth-workspace-settings-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ENDPOINT = "/api/growth/workspace/settings/profile"

const INITIAL: GrowthWorkspaceSettingsProfile = {
  userId: "",
  displayName: "",
  jobTitle: "",
  timezone: "UTC",
  avatarUrl: "",
  email: "",
}

function profileInitials(displayName: string, email: string): string {
  const source = displayName.trim() || email.trim()
  if (!source) return "?"
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function GrowthSettingsProfilePanel() {
  const selectValue = useCallback(
    (data: { profile?: GrowthWorkspaceSettingsProfile }) => data.profile ?? null,
    [],
  )
  const { value, loading, saving, error, refresh, patch } = useGrowthWorkspaceSettingsResource({
    endpoint: ENDPOINT,
    initialValue: INITIAL,
    selectValue,
  })
  const [draft, setDraft] = useState(INITIAL)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const timezoneLabel = useMemo(
    () => resolveGrowthWorkspaceTimezoneLabel(draft.timezone),
    [draft.timezone],
  )

  const displayName = draft.displayName.trim() || "Your name"
  const jobTitle = draft.jobTitle.trim()

  async function commitField<K extends keyof GrowthWorkspaceSettingsProfile>(field: K) {
    if (draft[field] === value[field]) return
    await patch({ [field]: draft[field] } as Partial<GrowthWorkspaceSettingsProfile>)
  }

  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Profile"
        description="How you appear across Growth."
        icon={User}
      />

      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}

      {!loading && !error ? (
        <GrowthSettingsSectionForm footer={<GrowthSettingsSaveStatus saving={saving} />}>
          <GrowthSettingsCard title="Identity">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar className="size-16 shrink-0 ring-2 ring-border/60">
                {draft.avatarUrl ? <AvatarImage src={draft.avatarUrl} alt={displayName} /> : null}
                <AvatarFallback className="bg-muted text-base font-semibold text-foreground">
                  {profileInitials(draft.displayName, draft.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-lg font-semibold tracking-tight text-foreground">{displayName}</p>
                <p className="text-sm text-muted-foreground">
                  {jobTitle || "Add a job title below"}
                </p>
                {draft.email ? (
                  <p className="truncate text-sm text-muted-foreground">{draft.email}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {timezoneLabel.friendly}
                  <span className="mx-1 text-muted-foreground/50">·</span>
                  {timezoneLabel.iana}
                </p>
              </div>
            </div>
          </GrowthSettingsCard>

          <GrowthSettingsCard title="Details">
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <GrowthSettingsField label="Display name">
                <Input
                  value={draft.displayName}
                  onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                  onBlur={() => void commitField("displayName")}
                  disabled={saving}
                  maxLength={200}
                  placeholder="Your name"
                />
              </GrowthSettingsField>

              <GrowthSettingsField
                label="Job title"
                description="Optional — shown on your profile and in collaboration surfaces."
              >
                <Input
                  value={draft.jobTitle}
                  onChange={(event) => setDraft((current) => ({ ...current, jobTitle: event.target.value }))}
                  onBlur={() => void commitField("jobTitle")}
                  disabled={saving}
                  maxLength={200}
                  placeholder="e.g. Owner, Account Executive"
                />
              </GrowthSettingsField>

              <GrowthSettingsField label="Email" description="Managed by your account.">
                <Input value={draft.email || "Not available"} disabled readOnly className="bg-muted/40" />
              </GrowthSettingsField>

              <GrowthSettingsField label="Timezone" description="Used for quiet hours and scheduling.">
                <Select
                  value={draft.timezone}
                  onValueChange={(next) => {
                    setDraft((current) => ({ ...current, timezone: next }))
                    void patch({ timezone: next })
                  }}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {GROWTH_WORKSPACE_SETTINGS_TIMEZONE_OPTIONS.map((timezone) => {
                      const option = resolveGrowthWorkspaceTimezoneLabel(timezone)
                      return (
                        <SelectItem key={timezone} value={timezone}>
                          <span className="flex flex-col items-start gap-0.5">
                            <span>{option.friendly}</span>
                            <span className="text-xs text-muted-foreground">{option.iana}</span>
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </GrowthSettingsField>

              <GrowthSettingsField
                label="Photo"
                description="Optional — stored in your media library."
              >
                <GrowthMediaPicker
                  value={draft.avatarUrl}
                  acceptedTypes={["team"]}
                  allowManualUrl
                  disabled={saving}
                  onChange={(url) => {
                    setDraft((current) => ({ ...current, avatarUrl: url }))
                    void patch({ avatarUrl: url })
                  }}
                />
              </GrowthSettingsField>
            </div>
          </GrowthSettingsCard>
        </GrowthSettingsSectionForm>
      ) : null}
    </div>
  )
}
