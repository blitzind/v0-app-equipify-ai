"use client"

import { useCallback } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import {
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
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
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useGrowthWorkspaceSettingsResource } from "@/hooks/growth/use-growth-workspace-settings-resource"
import {
  GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS,
  GROWTH_OPERATOR_NOTIFICATION_EVENTS,
  GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP,
  type GrowthOperatorNotificationEvent,
  type GrowthOperatorNotificationEventGroup,
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

const NOTIFICATION_EVENT_LABELS: Record<GrowthOperatorNotificationEvent, string> = {
  lead_hot: "Hot lead detected",
  engagement_spike: "Engagement spike",
  share_page_viewed: "Share page viewed",
  share_page_engaged: "Share page engaged",
  share_page_cta_clicked: "Share page CTA clicked",
  share_page_booking_started: "Share page booking started",
  share_page_booking_completed: "Share page booking completed",
  reply_received: "Reply received",
  reply_positive_interest: "Positive interest reply",
  reply_meeting_requested: "Meeting requested",
  reply_competitor_detected: "Competitor mentioned",
  sequence_wait_started: "Sequence wait started",
  sequence_wait_resolved: "Sequence wait resolved",
  sequence_wait_timeout: "Sequence wait timed out",
  sequence_branch_evaluated: "Sequence branch evaluated",
  sequence_advancement_blocked: "Sequence advancement blocked",
  sms_reply_received: "SMS reply received",
  voice_drop_failed: "Voicemail drop failed",
  thread_sla_at_risk: "Inbox SLA at risk",
  thread_sla_overdue: "Inbox SLA overdue",
}

const NOTIFICATION_GROUP_META: Record<
  GrowthOperatorNotificationEventGroup,
  { title: string; description: string }
> = {
  lead: { title: "Leads", description: "Pipeline and engagement signals." },
  share_page: { title: "Share Pages", description: "Visitor activity on shared pages." },
  reply: { title: "Replies", description: "Inbound reply classifications." },
  sequence: { title: "Campaigns", description: "Sequence progression and waits." },
  messaging: { title: "Calls & messaging", description: "SMS and voice delivery events." },
  inbox: { title: "Inbox", description: "Thread SLA and queue alerts." },
}

const NOTIFICATION_GROUP_ORDER: GrowthOperatorNotificationEventGroup[] = [
  "lead",
  "inbox",
  "reply",
  "messaging",
  "sequence",
  "share_page",
]

function groupEventsByCategory(): Record<GrowthOperatorNotificationEventGroup, GrowthOperatorNotificationEvent[]> {
  const grouped = Object.fromEntries(
    GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS.map((group) => [group, [] as GrowthOperatorNotificationEvent[]]),
  ) as Record<GrowthOperatorNotificationEventGroup, GrowthOperatorNotificationEvent[]>

  for (const event of GROWTH_OPERATOR_NOTIFICATION_EVENTS) {
    grouped[GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP[event]].push(event)
  }
  return grouped
}

const GROUPED_EVENTS = groupEventsByCategory()

function formatSeverityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

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
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_GENERAL_REFINEMENT_2B_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Notifications"
        description="Choose how and when Growth alerts you."
        icon={Bell}
      />

      <p className="text-sm text-muted-foreground">
        Equipment, work orders, and digest alerts live in{" "}
        <Link href={GROWTH_CORE_SETTINGS_WORKSPACE_NOTIFICATIONS_PATH} className="font-medium text-primary underline-offset-4 hover:underline">
          Workspace notifications
        </Link>
        .
      </p>

      {loading ? <GrowthSettingsSectionLoadingState /> : null}
      {!loading && error ? <GrowthSettingsSectionErrorState message={error} onRetry={() => void refresh()} /> : null}

      {!loading && !error ? (
        <GrowthSettingsSectionForm footer={<GrowthSettingsSaveStatus saving={saving} />}>
          <GrowthSettingsCard title="Delivery">
            <div className="space-y-2">
              <GrowthSettingsToggleRow
                label="Browser notifications"
                description="Desktop push for live alerts."
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
              <GrowthSettingsToggleRow
                label="In-app notifications"
                description="Notification center and inbox alerts."
                checked={value.inAppEnabled}
                disabled={saving}
                onCheckedChange={(checked) => void savePatch({ inAppEnabled: checked })}
              />
              <GrowthSettingsField label="Minimum severity" description="Only show alerts at or above this level.">
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
                        {formatSeverityLabel(severity)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GrowthSettingsField>
            </div>
          </GrowthSettingsCard>

          {NOTIFICATION_GROUP_ORDER.map((group) => {
            const events = GROUPED_EVENTS[group]
            if (events.length === 0) return null
            const meta = NOTIFICATION_GROUP_META[group]
            return (
              <GrowthSettingsCard key={group} title={meta.title}>
                <p className="mb-3 text-xs text-muted-foreground">{meta.description}</p>
                <div className="space-y-2">
                  {events.map((event) => (
                    <GrowthSettingsToggleRow
                      key={event}
                      label={NOTIFICATION_EVENT_LABELS[event]}
                      checked={!value.disabledEventTypes.includes(event)}
                      disabled={saving}
                      onCheckedChange={() => toggleDisabledEvent(event)}
                    />
                  ))}
                </div>
              </GrowthSettingsCard>
            )
          })}
        </GrowthSettingsSectionForm>
      ) : null}
    </div>
  )
}
