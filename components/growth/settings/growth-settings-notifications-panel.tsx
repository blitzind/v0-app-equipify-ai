"use client"

import { useCallback } from "react"
import Link from "next/link"
import { Bell, Loader2 } from "lucide-react"
import {
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import {
  GrowthSettingsSectionErrorState,
  GrowthSettingsSectionForm,
  GrowthSettingsSectionLoadingState,
} from "@/components/growth/settings/growth-settings-section-form-state"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useGrowthWorkspaceSettingsResource } from "@/hooks/growth/use-growth-workspace-settings-resource"
import {
  GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS,
  GROWTH_OPERATOR_NOTIFICATION_EVENTS,
  GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP,
  type GrowthOperatorNotificationEvent,
} from "@/lib/growth/notifications/growth-notification-events"
import type { GrowthWorkspaceSettingsNotificationPreferences } from "@/lib/growth/settings/growth-workspace-settings-types"
import { DEFAULT_GROWTH_OPERATOR_NOTIFICATION_EFFECTIVE_PREFERENCES } from "@/lib/growth/notifications/growth-notification-preferences-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GROWTH_CORE_SETTINGS_WORKSPACE_NOTIFICATIONS_PATH } from "@/lib/growth/navigation/growth-workspace-core-settings-links"
import { GROWTH_OPERATOR_NOTIFICATION_SEVERITIES } from "@/lib/growth/notifications/growth-notification-severity"

const ENDPOINT = "/api/growth/workspace/settings/notifications"

function groupEventsByCategory(): Record<string, GrowthOperatorNotificationEvent[]> {
  const grouped: Record<string, GrowthOperatorNotificationEvent[]> = {}
  for (const group of GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS) {
    grouped[group] = []
  }
  for (const event of GROWTH_OPERATOR_NOTIFICATION_EVENTS) {
    grouped[GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP[event]].push(event)
  }
  return grouped
}

const GROUPED_EVENTS = groupEventsByCategory()

export function GrowthSettingsNotificationsPanel() {
  const selectValue = useCallback(
    (data: { preferences?: GrowthWorkspaceSettingsNotificationPreferences }) => data.preferences ?? null,
    [],
  )
  const { value, loading, saving, error, refresh, patch } = useGrowthWorkspaceSettingsResource({
    endpoint: ENDPOINT,
    initialValue: DEFAULT_GROWTH_OPERATOR_NOTIFICATION_EFFECTIVE_PREFERENCES,
    selectValue,
  })

  async function savePatch(patchValue: Partial<GrowthWorkspaceSettingsNotificationPreferences>) {
    await patch(patchValue)
  }

  function toggleDisabledEvent(event: GrowthOperatorNotificationEvent) {
    const disabled = new Set(value.disabledEventTypes)
    if (disabled.has(event)) disabled.delete(event)
    else disabled.add(event)
    void savePatch({ disabledEventTypes: Array.from(disabled) })
  }

  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP}>
      <GrowthWorkspacePageHeader
        title="Notifications"
        description="Outreach, inbox, campaign, and activity alerts."
        icon={Bell}
      />

      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Growth notifications</p>
        <p className="mt-1">
          Configure outreach, inbox, campaign, and activity alerts here. For equipment, work orders, and digest
          alerts, use{" "}
          <Link href={GROWTH_CORE_SETTINGS_WORKSPACE_NOTIFICATIONS_PATH} className="font-medium text-primary underline-offset-4 hover:underline">
            Workspace notifications
          </Link>
          .
        </p>
      </div>

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
          <GrowthSettingsCard title="Delivery channels">
            <div className="space-y-2">
              <GrowthSettingsToggleRow
                label="Browser notifications"
                description="Desktop push for live operator signals."
                checked={value.browserPushEnabled}
                disabled={saving}
                onCheckedChange={(checked) => void savePatch({ browserPushEnabled: checked })}
              />
              <GrowthSettingsToggleRow
                label="Email notifications"
                description="Email delivery for activity alerts."
                checked={value.emailNotificationsEnabled}
                disabled={saving}
                onCheckedChange={(checked) => void savePatch({ emailNotificationsEnabled: checked })}
              />
            </div>
          </GrowthSettingsCard>

          <GrowthSettingsCard title="Inbox notification preferences">
            <div className="space-y-3">
              <GrowthSettingsToggleRow
                label="In-app inbox notifications"
                description="Notification center and inbox alerts."
                checked={value.inAppEnabled}
                disabled={saving}
                onCheckedChange={(checked) => void savePatch({ inAppEnabled: checked })}
              />

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Minimum severity</p>
                <Select
                  value={value.minimumSeverity}
                  onValueChange={(next) =>
                    void savePatch({
                      minimumSeverity: next as GrowthWorkspaceSettingsNotificationPreferences["minimumSeverity"],
                    })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROWTH_OPERATOR_NOTIFICATION_SEVERITIES.map((severity) => (
                      <SelectItem key={severity} value={severity}>
                        {severity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {Object.entries(GROUPED_EVENTS).map(([group, events]) =>
                events.length === 0 ? null : (
                  <div key={group} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
                    {events.map((event) => (
                      <GrowthSettingsToggleRow
                        key={event}
                        label={event.replaceAll("_", " ")}
                        checked={!value.disabledEventTypes.includes(event)}
                        disabled={saving}
                        onCheckedChange={() => toggleDisabledEvent(event)}
                      />
                    ))}
                  </div>
                ),
              )}
            </div>
          </GrowthSettingsCard>
        </GrowthSettingsSectionForm>
      ) : null}
    </div>
  )
}
