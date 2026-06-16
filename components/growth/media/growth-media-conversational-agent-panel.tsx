"use client"

import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  extractContentMergeFields,
  isBlockedContentVariable,
  validateContentMergeFields,
} from "@/lib/growth/content/merge-field-validator"
import {
  GROWTH_MEDIA_RETELL_CONVERSATIONAL_AGENT_CATALOG,
  listEnabledConversationalAgents,
  type GrowthMediaConversationalAgentDefinition,
} from "@/lib/growth/media/media-conversational-agent-types"
import { GROWTH_MEDIA_CONVERSATIONAL_QUALIFICATION_CATALOG } from "@/lib/growth/media/media-conversational-qualification-types"
import { GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS } from "@/lib/growth/media/media-conversational-session-types"
import {
  buildConversationPreview,
  buildQualificationPreview,
  evaluateQualificationState,
} from "@/lib/growth/media/media-conversational-session-utils"
import type { GrowthSharePageTemplateVideoConversationalAgentSettings } from "@/lib/growth/share-pages/share-page-template-block-types"

function defaultConversationalAgentSettings(): GrowthSharePageTemplateVideoConversationalAgentSettings {
  const defaultAgent = GROWTH_MEDIA_RETELL_CONVERSATIONAL_AGENT_CATALOG[0]
  return {
    enabled: false,
    agentId: defaultAgent?.agentId ?? null,
    qualificationGoal: defaultAgent?.qualificationGoals[0]?.goalId ?? "meeting_readiness",
    systemPromptTemplate:
      defaultAgent?.systemPrompt ??
      "You are speaking with {{prospect.name}} at {{company.name}} on behalf of {{sender.company}}.",
    mergeFieldsUsed: ["prospect.name", "company.name", "sender.company"],
  }
}

export function GrowthMediaConversationalAgentPanel({
  conversationalAgent,
  mergeValues,
  disabled,
  onChange,
}: {
  conversationalAgent: GrowthSharePageTemplateVideoConversationalAgentSettings | null | undefined
  mergeValues: Record<string, string>
  disabled?: boolean
  onChange: (next: GrowthSharePageTemplateVideoConversationalAgentSettings) => void
}) {
  const settings = conversationalAgent ?? defaultConversationalAgentSettings()
  const agents = listEnabledConversationalAgents("retell")
  const selectedAgent: GrowthMediaConversationalAgentDefinition | null =
    agents.find((agent) => agent.agentId === settings.agentId) ?? agents[0] ?? null
  const qualificationGoals = selectedAgent?.qualificationGoals ?? []
  const goalOptions =
    qualificationGoals.length > 0
      ? qualificationGoals
      : GROWTH_MEDIA_CONVERSATIONAL_QUALIFICATION_CATALOG.map((entry) => ({
          goalId: entry.goal,
          label: entry.goal.replace(/_/g, " "),
          description: entry.questions[0] ?? "",
        }))

  const allowedKeys = useMemo(() => new Set(Object.keys(mergeValues)), [mergeValues])
  const promptPreview = useMemo(
    () =>
      buildConversationPreview({
        agentId: settings.agentId,
        systemPromptTemplate: settings.systemPromptTemplate ?? "",
        conversationContext: {
          prospectName: mergeValues["prospect.name"] ?? mergeValues["lead.contact_name"],
          companyName: mergeValues["company.name"] ?? mergeValues["lead.company_name"],
          senderName: mergeValues["sender.name"],
          senderCompany: mergeValues["sender.company"],
          qualificationGoal: settings.qualificationGoal,
          customMergeValues: mergeValues,
        },
      }),
    [mergeValues, settings.agentId, settings.qualificationGoal, settings.systemPromptTemplate],
  )

  const qualificationPreview = useMemo(
    () => buildQualificationPreview({ qualificationGoal: settings.qualificationGoal }),
    [settings.qualificationGoal],
  )

  const qualificationEvaluation = useMemo(
    () =>
      evaluateQualificationState({
        qualificationGoal: settings.qualificationGoal,
        conversationContext: {
          prospectName: mergeValues["prospect.name"],
          companyName: mergeValues["company.name"],
        },
      }),
    [mergeValues, settings.qualificationGoal],
  )

  const mergeValidation = validateContentMergeFields({
    text: settings.systemPromptTemplate ?? "",
    allowedKeys,
  })
  const detectedFields = extractContentMergeFields(settings.systemPromptTemplate ?? "")
  const blockedFields = detectedFields.filter(isBlockedContentVariable)

  const updateSettings = (patch: Partial<GrowthSharePageTemplateVideoConversationalAgentSettings>) => {
    const nextPrompt = patch.systemPromptTemplate ?? settings.systemPromptTemplate ?? ""
    onChange({
      ...settings,
      ...patch,
      mergeFieldsUsed: extractContentMergeFields(nextPrompt),
    })
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-violet-300/80 p-3 dark:border-violet-900">
      <div>
        <p className="text-sm font-medium">Retell conversational agent (S2-H foundation)</p>
        <p className="text-xs text-muted-foreground">
          Agent + qualification preview only — no Start Conversation button, WebRTC, provider execution, playback, or generated media.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={disabled}
          onChange={(e) => updateSettings({ enabled: e.target.checked })}
        />
        Enable conversational mode for this placeholder
      </label>

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <div className="flex size-24 items-center justify-center rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground">
          {selectedAgent?.displayName?.slice(0, 1) ?? "A"}
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Conversational agent</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={settings.agentId ?? ""}
              disabled={disabled || !settings.enabled}
              onChange={(e) => {
                const nextAgent = agents.find((agent) => agent.agentId === e.target.value) ?? null
                updateSettings({
                  agentId: e.target.value || null,
                  qualificationGoal: nextAgent?.qualificationGoals[0]?.goalId ?? settings.qualificationGoal,
                  systemPromptTemplate: nextAgent?.systemPrompt ?? settings.systemPromptTemplate,
                })
              }}
            >
              {agents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.displayName} ({agent.language})
                </option>
              ))}
            </select>
          </div>
          {selectedAgent ? (
            <p className="text-[11px] text-muted-foreground">
              {selectedAgent.personality ?? "neutral"} · Avatar {selectedAgent.avatarId ?? "n/a"} · Voice{" "}
              {selectedAgent.voiceId ?? "n/a"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Qualification goal</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={settings.qualificationGoal ?? ""}
          disabled={disabled || !settings.enabled}
          onChange={(e) => updateSettings({ qualificationGoal: e.target.value || null })}
        >
          {goalOptions.map((goal) => (
            <option key={goal.goalId} value={goal.goalId}>
              {goal.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">System prompt template</Label>
        <Textarea
          value={settings.systemPromptTemplate ?? ""}
          disabled={disabled || !settings.enabled}
          rows={4}
          onChange={(e) => updateSettings({ systemPromptTemplate: e.target.value })}
        />
      </div>

      {detectedFields.length > 0 ? (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px]">
          <p className="font-medium">Merge fields detected</p>
          <p className="mt-1 text-muted-foreground">{detectedFields.join(", ")}</p>
          {blockedFields.length > 0 ? (
            <p className="mt-1 text-rose-600">Blocked: {blockedFields.join(", ")}</p>
          ) : null}
          {mergeValidation.unknownVariables.length > 0 ? (
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Unknown: {mergeValidation.unknownVariables.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-background p-3 text-xs">
        <p className="font-medium">Resolved prompt preview</p>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{promptPreview.resolvedPrompt}</p>
        {promptPreview.usedFallback ? (
          <p className="mt-2 text-amber-700 dark:text-amber-300">Fallback preview text used.</p>
        ) : null}
      </div>

      {qualificationPreview.steps.length > 0 ? (
        <div className="rounded-md border border-border bg-background p-3 text-xs">
          <p className="font-medium">Qualification steps preview</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {qualificationPreview.steps.map((step) => (
              <li key={step.id}>• {step.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-background p-3 text-xs">
        <p className="font-medium">Booking recommendation preview</p>
        <p className="mt-2 text-muted-foreground">{qualificationEvaluation.meetingRecommendation.rationale}</p>
        <p className="mt-2">
          Recommend booking:{" "}
          <span className="font-medium">
            {qualificationEvaluation.meetingRecommendation.recommendBooking ? "yes" : "no"}
          </span>{" "}
          · Readiness: {qualificationEvaluation.meetingRecommendation.readinessTier}
        </p>
        {qualificationEvaluation.meetingRecommendation.suggestedAttendees.length > 0 ? (
          <p className="mt-1 text-muted-foreground">
            Suggested attendees: {qualificationEvaluation.meetingRecommendation.suggestedAttendees.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="rounded-md border border-emerald-300/70 bg-emerald-50/70 p-2 text-[11px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-medium">Safety state</p>
        <p>provider_execution_enabled: {String(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.provider_execution_enabled)}</p>
        <p>autonomous_execution_enabled: {String(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.autonomous_execution_enabled)}</p>
        <p>no_conversation_execution: {String(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_conversation_execution)}</p>
        <p>no_generated_media_assets: {String(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_generated_media_assets)}</p>
        <p>no_playback: {String(GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS.no_playback)}</p>
      </div>
    </div>
  )
}
