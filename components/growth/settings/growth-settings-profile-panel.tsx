"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
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
        description="Operator identity and display preferences for the Growth workspace."
        icon={User}
        iconClassName="bg-slate-100 text-slate-600"
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
              <GrowthSettingsField label="Display name" description="Shown across Growth workspace surfaces.">
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
                label="Avatar URL"
                description="Public image URL for your operator avatar."
              >
                <Input
                  value={draft.avatarUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, avatarUrl: event.target.value }))}
                  onBlur={() => void commitField("avatarUrl")}
                  disabled={saving}
                  placeholder="https://…"
                />
              </GrowthSettingsField>

              {draft.avatarUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draft.avatarUrl}
                    alt=""
                    className="size-10 rounded-full object-cover"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      setDraft((current) => ({ ...current, avatarUrl: "" }))
                      void patch({ avatarUrl: "" })
                    }}
                  >
                    Clear avatar URL
                  </Button>
                </div>
              ) : null}
            </div>
          </GrowthSettingsCard>
        </GrowthSettingsSectionForm>
      ) : null}
    </div>
  )
}
