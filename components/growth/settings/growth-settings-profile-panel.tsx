"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  GrowthSettingsCard,
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import {
  GrowthSettingsField,
  GrowthSettingsSectionErrorState,
  GrowthSettingsSectionForm,
  GrowthSettingsSectionLoadingState,
} from "@/components/growth/settings/growth-settings-section-form-state"
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useGrowthWorkspaceSettingsResource } from "@/hooks/growth/use-growth-workspace-settings-resource"
import { GROWTH_WORKSPACE_SETTINGS_TIMEZONE_OPTIONS } from "@/lib/growth/settings/growth-workspace-settings-options"
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

  async function commitField<K extends keyof GrowthWorkspaceSettingsProfile>(field: K) {
    if (draft[field] === value[field]) return
    await patch({ [field]: draft[field] } as Partial<GrowthWorkspaceSettingsProfile>)
  }

  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      <GrowthWorkspacePageHeader
        title="Profile"
        description="Your name, title, timezone, and avatar shown across Growth."
        icon={User}
      />

      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}

      {!loading && !error ? (
        <GrowthSettingsSectionForm
          footer={
            saving ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </p>
            ) : null
          }
        >
          <GrowthSettingsCard title="Operator identity">
            <div className={GROWTH_SETTINGS_FORM_GAP}>
              <GrowthSettingsField label="Display name" description="Shown across Growth surfaces.">
                <Input
                  value={draft.displayName}
                  onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                  onBlur={() => void commitField("displayName")}
                  disabled={saving}
                  maxLength={200}
                />
              </GrowthSettingsField>

              <GrowthSettingsField label="Job title" description="Stored on your organization membership.">
                <Input
                  value={draft.jobTitle}
                  onChange={(event) => setDraft((current) => ({ ...current, jobTitle: event.target.value }))}
                  onBlur={() => void commitField("jobTitle")}
                  disabled={saving}
                  maxLength={200}
                />
              </GrowthSettingsField>

              <GrowthSettingsField label="Email" description="Managed by your account — read only here.">
                <Input value={draft.email} disabled readOnly />
              </GrowthSettingsField>

              <GrowthSettingsField label="Timezone" description="Used for quiet hours and scheduling context.">
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
                    {GROWTH_WORKSPACE_SETTINGS_TIMEZONE_OPTIONS.map((timezone) => (
                      <SelectItem key={timezone} value={timezone}>
                        {timezone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GrowthSettingsField>

              <GrowthSettingsField
                label="Team photo"
                description="Headshot stored in the Growth media library and reused across surfaces."
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
