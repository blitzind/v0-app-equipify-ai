"use client"

import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS } from "@/lib/growth/media/media-booking-handoff-types"
import { buildBookingPreview } from "@/lib/growth/media/media-booking-handoff-utils"
import type { GrowthSharePageTemplateVideoBookingHandoffSettings } from "@/lib/growth/share-pages/share-page-template-block-types"

function defaultBookingHandoffSettings(): GrowthSharePageTemplateVideoBookingHandoffSettings {
  return {
    enabled: false,
    readinessTier: "not_ready",
    readinessScore: 0,
    recommendedMeetingType: null,
    recommendedDurationMinutes: null,
    recommendedAttendees: [],
    bookingRecommendation: null,
    agendaTemplate: "Intro for {{prospect.name}} at {{company.name}} · goals · fit · next steps",
    nextSteps: [],
  }
}

export function GrowthMediaBookingHandoffPanel({
  bookingHandoff,
  mergeValues,
  qualificationGoal,
  aiQaEnabled,
  conversationEnabled,
  disabled,
  onChange,
}: {
  bookingHandoff: GrowthSharePageTemplateVideoBookingHandoffSettings | null | undefined
  mergeValues: Record<string, string>
  qualificationGoal?: string | null
  aiQaEnabled?: boolean
  conversationEnabled?: boolean
  disabled?: boolean
  onChange: (next: GrowthSharePageTemplateVideoBookingHandoffSettings) => void
}) {
  const settings = bookingHandoff ?? defaultBookingHandoffSettings()

  const preview = useMemo(
    () =>
      buildBookingPreview({
        qualificationGoal: qualificationGoal ?? "meeting_readiness",
        prospectName: mergeValues["prospect.name"] ?? mergeValues["lead.contact_name"],
        companyName: mergeValues["company.name"] ?? mergeValues["lead.company_name"],
        aiQaEnabled: aiQaEnabled ?? false,
        conversationEnabled: conversationEnabled ?? false,
        bookingHandoffEnabled: settings.enabled,
        agendaTemplate: settings.agendaTemplate,
      }),
    [
      aiQaEnabled,
      conversationEnabled,
      mergeValues,
      qualificationGoal,
      settings.agendaTemplate,
      settings.enabled,
    ],
  )

  const updateSettings = (patch: Partial<GrowthSharePageTemplateVideoBookingHandoffSettings>) => {
    onChange({
      ...settings,
      ...patch,
    })
  }

  const syncPreviewToSettings = () => {
    onChange({
      ...settings,
      enabled: true,
      readinessTier: preview.readiness.readinessTier,
      readinessScore: preview.readiness.readinessScore,
      recommendedMeetingType: preview.recommendation.recommendedMeetingType,
      recommendedDurationMinutes: preview.recommendation.recommendedDurationMinutes,
      recommendedAttendees: preview.recommendation.recommendedAttendees,
      bookingRecommendation: preview.recommendation.bookingRecommendation,
      agendaTemplate: settings.agendaTemplate ?? preview.recommendation.recommendedAgenda,
      nextSteps: preview.recommendation.recommendedNextSteps,
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-emerald-300/80 p-3 dark:border-emerald-900">
      <div>
        <p className="text-sm font-medium">Booking handoff (S2-J foundation)</p>
        <p className="text-xs text-muted-foreground">
          Readiness + recommendation preview only — no scheduling, calendar creation, reminders, or notifications.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={disabled}
          onChange={(e) => {
            const enabled = e.target.checked
            if (enabled) {
              syncPreviewToSettings()
            } else {
              updateSettings({ enabled: false })
            }
          }}
        />
        Enable booking handoff preview for this conversational agent
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-3 text-xs">
          <p className="font-medium">Readiness</p>
          <p className="mt-2">
            Tier: <span className="font-medium">{preview.readiness.readinessTier}</span>
          </p>
          <p>Score: {preview.readiness.readinessScore}</p>
          <p>Fit: {preview.readiness.fitScore}</p>
          <p>Committee coverage: {preview.readiness.buyingCommitteeCoverage}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-3 text-xs">
          <p className="font-medium">Qualification signals</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {preview.recommendation.signals.map((signal) => (
              <li key={signal.key}>
                • {signal.label} ({signal.strength})
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-md border border-border bg-background p-3 text-xs">
        <p className="font-medium">Meeting recommendation</p>
        <p className="mt-2">
          {preview.recommendation.recommendedMeetingType} · {preview.recommendation.recommendedDurationMinutes} min
        </p>
        <p className="mt-1 text-muted-foreground">{preview.recommendation.bookingRecommendation}</p>
        <p className="mt-2 text-muted-foreground">{preview.recommendation.rationale}</p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Agenda template</Label>
        <Textarea
          value={settings.agendaTemplate ?? ""}
          disabled={disabled || !settings.enabled}
          rows={3}
          onChange={(e) => updateSettings({ agendaTemplate: e.target.value || null })}
        />
        <p className="text-[11px] text-muted-foreground">Resolved preview: {preview.recommendation.recommendedAgenda}</p>
      </div>

      <div className="rounded-md border border-border bg-background p-3 text-xs">
        <p className="font-medium">Suggested attendees</p>
        <p className="mt-2 text-muted-foreground">{preview.recommendation.recommendedAttendees.join(", ")}</p>
      </div>

      <div className="rounded-md border border-border bg-background p-3 text-xs">
        <p className="font-medium">Next steps</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {preview.recommendation.recommendedNextSteps.map((step) => (
            <li key={step}>• {step}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-emerald-300/70 bg-emerald-50/70 p-2 text-[11px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-medium">Safety state</p>
        <p>calendar_execution_enabled: {String(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.calendar_execution_enabled)}</p>
        <p>booking_execution_enabled: {String(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.booking_execution_enabled)}</p>
        <p>no_calendar_creation: {String(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.no_calendar_creation)}</p>
        <p>requires_human_review: {String(GROWTH_MEDIA_BOOKING_HANDOFF_SAFETY_FLAGS.requires_human_review)}</p>
      </div>
    </div>
  )
}
