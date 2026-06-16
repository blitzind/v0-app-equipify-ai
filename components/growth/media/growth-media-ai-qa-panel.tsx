"use client"

import { useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  extractContentMergeFields,
  isBlockedContentVariable,
  validateContentMergeFields,
} from "@/lib/growth/content/merge-field-validator"
import { GROWTH_MEDIA_AI_QA_SAFETY_FLAGS } from "@/lib/growth/media/media-ai-qa-types"
import {
  GROWTH_MEDIA_AI_QA_KNOWLEDGE_SOURCE_TYPES,
  type GrowthMediaAiQaKnowledgeSourceRef,
} from "@/lib/growth/media/media-ai-qa-knowledge-types"
import { listEnabledQaPolicies } from "@/lib/growth/media/media-ai-qa-policy-types"
import {
  buildBookingRecommendationPreview,
  buildQuestionPreview,
  buildSafeAnswerPreview,
  normalizeKnowledgeSourceRefs,
} from "@/lib/growth/media/media-ai-qa-utils"
import type { GrowthSharePageTemplateVideoAiQaSettings } from "@/lib/growth/share-pages/share-page-template-block-types"

function defaultAiQaSettings(): GrowthSharePageTemplateVideoAiQaSettings {
  return {
    enabled: false,
    policyId: "qa-policy-safe-default",
    questionPromptTemplate: "What would {{prospect.name}} like to know about {{sender.company}}?",
    fallbackResponse:
      "Thanks for your question. A member of our team will follow up with a precise answer shortly.",
    knowledgeSourceRefs: [{ sourceType: "share_page_template", sourceId: null, label: "Template content", enabled: true }],
    mergeFieldsUsed: ["prospect.name", "sender.company"],
    bookingHandoffEnabled: true,
  }
}

export function GrowthMediaAiQaPanel({
  aiQa,
  mergeValues,
  qualificationGoal,
  disabled,
  onChange,
}: {
  aiQa: GrowthSharePageTemplateVideoAiQaSettings | null | undefined
  mergeValues: Record<string, string>
  qualificationGoal?: string | null
  disabled?: boolean
  onChange: (next: GrowthSharePageTemplateVideoAiQaSettings) => void
}) {
  const settings = aiQa ?? defaultAiQaSettings()
  const policies = listEnabledQaPolicies()
  const selectedPolicy = policies.find((policy) => policy.policyId === settings.policyId) ?? policies[0] ?? null
  const knowledgeRefs = normalizeKnowledgeSourceRefs(settings.knowledgeSourceRefs)

  const allowedKeys = useMemo(() => new Set(Object.keys(mergeValues)), [mergeValues])
  const personalizationContext = useMemo(
    () => ({
      prospectName: mergeValues["prospect.name"] ?? mergeValues["lead.contact_name"],
      companyName: mergeValues["company.name"] ?? mergeValues["lead.company_name"],
      senderName: mergeValues["sender.name"],
      senderCompany: mergeValues["sender.company"],
      qualificationGoal: qualificationGoal ?? null,
      customMergeValues: mergeValues,
    }),
    [mergeValues, qualificationGoal],
  )

  const questionPreview = useMemo(
    () =>
      buildQuestionPreview({
        questionTemplate: settings.questionPromptTemplate ?? "",
        personalizationContext,
      }),
    [personalizationContext, settings.questionPromptTemplate],
  )

  const safeAnswerPreview = useMemo(
    () =>
      buildSafeAnswerPreview({
        policyId: settings.policyId,
        fallbackResponse: settings.fallbackResponse,
        personalizationContext,
        questionTemplate: settings.questionPromptTemplate,
      }),
    [personalizationContext, settings.fallbackResponse, settings.policyId, settings.questionPromptTemplate],
  )

  const bookingPreview = useMemo(
    () =>
      buildBookingRecommendationPreview({
        bookingHandoffEnabled: settings.bookingHandoffEnabled,
        qualificationGoal,
        personalizationContext,
        policyId: settings.policyId,
      }),
    [personalizationContext, qualificationGoal, settings.bookingHandoffEnabled, settings.policyId],
  )

  const mergeValidation = validateContentMergeFields({
    text: settings.questionPromptTemplate ?? "",
    allowedKeys,
  })
  const detectedFields = extractContentMergeFields(settings.questionPromptTemplate ?? "")
  const blockedFields = detectedFields.filter(isBlockedContentVariable)

  const updateSettings = (patch: Partial<GrowthSharePageTemplateVideoAiQaSettings>) => {
    const nextPrompt = patch.questionPromptTemplate ?? settings.questionPromptTemplate ?? ""
    onChange({
      ...settings,
      ...patch,
      mergeFieldsUsed: extractContentMergeFields(nextPrompt),
    })
  }

  const updateKnowledgeRef = (index: number, patch: Partial<GrowthMediaAiQaKnowledgeSourceRef>) => {
    const nextRefs = [...knowledgeRefs]
    nextRefs[index] = { ...nextRefs[index], ...patch }
    updateSettings({ knowledgeSourceRefs: nextRefs })
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-amber-300/80 p-3 dark:border-amber-900">
      <div>
        <p className="text-sm font-medium">AI Q&A (S2-I foundation)</p>
        <p className="text-xs text-muted-foreground">
          Answer policy + safe preview only — no public Q&A widget, LLM calls, retrieval, or autonomous responses.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={disabled}
          onChange={(e) => updateSettings({ enabled: e.target.checked })}
        />
        Enable AI Q&A spec for this conversational agent
      </label>

      <div className="space-y-1">
        <Label className="text-xs">Answer policy</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={settings.policyId ?? ""}
          disabled={disabled || !settings.enabled}
          onChange={(e) => updateSettings({ policyId: e.target.value || null })}
        >
          {policies.map((policy) => (
            <option key={policy.policyId} value={policy.policyId}>
              {policy.name}
            </option>
          ))}
        </select>
        {selectedPolicy ? (
          <p className="text-[11px] text-muted-foreground">
            Human review: {selectedPolicy.requiresHumanReview ? "required" : "optional"} · Pricing answers:{" "}
            {selectedPolicy.allowPricingAnswers ? "allowed" : "blocked"} · Competitor answers:{" "}
            {selectedPolicy.allowCompetitorAnswers ? "allowed" : "blocked"}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Question prompt template</Label>
        <Textarea
          value={settings.questionPromptTemplate ?? ""}
          disabled={disabled || !settings.enabled}
          rows={3}
          onChange={(e) => updateSettings({ questionPromptTemplate: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Fallback response</Label>
        <Textarea
          value={settings.fallbackResponse ?? ""}
          disabled={disabled || !settings.enabled}
          rows={3}
          onChange={(e) => updateSettings({ fallbackResponse: e.target.value })}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.bookingHandoffEnabled ?? false}
          disabled={disabled || !settings.enabled}
          onChange={(e) => updateSettings({ bookingHandoffEnabled: e.target.checked })}
        />
        Enable booking handoff readiness preview
      </label>

      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2 text-[11px]">
        <p className="font-medium">Knowledge source references (metadata only)</p>
        {knowledgeRefs.map((ref, index) => (
          <div key={`${ref.sourceType}-${index}`} className="grid gap-2 sm:grid-cols-2">
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={ref.sourceType}
              disabled={disabled || !settings.enabled}
              onChange={(e) =>
                updateKnowledgeRef(index, {
                  sourceType: e.target.value as GrowthMediaAiQaKnowledgeSourceRef["sourceType"],
                })
              }
            >
              {GROWTH_MEDIA_AI_QA_KNOWLEDGE_SOURCE_TYPES.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {sourceType}
                </option>
              ))}
            </select>
            <input
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={ref.label ?? ""}
              disabled={disabled || !settings.enabled}
              placeholder="Label"
              onChange={(e) => updateKnowledgeRef(index, { label: e.target.value || null })}
            />
          </div>
        ))}
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
        <p className="font-medium">Resolved question preview</p>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{questionPreview.resolvedQuestion}</p>
      </div>

      <div className="rounded-md border border-border bg-background p-3 text-xs">
        <p className="font-medium">Safe answer preview</p>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{safeAnswerPreview.previewAnswer}</p>
        <p className="mt-2 text-muted-foreground">
          Uses fallback: {String(safeAnswerPreview.usesFallback)} · Human review required:{" "}
          {String(safeAnswerPreview.requiresHumanReview)}
        </p>
      </div>

      <div className="rounded-md border border-border bg-background p-3 text-xs">
        <p className="font-medium">Booking handoff readiness</p>
        <p className="mt-2 text-muted-foreground">{bookingPreview.rationale}</p>
        <p className="mt-2">
          Handoff ready: <span className="font-medium">{bookingPreview.handoffReady ? "yes" : "no"}</span>
        </p>
      </div>

      <div className="rounded-md border border-emerald-300/70 bg-emerald-50/70 p-2 text-[11px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-medium">Safety state</p>
        <p>provider_execution_enabled: {String(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.provider_execution_enabled)}</p>
        <p>autonomous_execution_enabled: {String(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.autonomous_execution_enabled)}</p>
        <p>no_ai_answer_generated: {String(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_ai_answer_generated)}</p>
        <p>no_retrieval_executed: {String(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_retrieval_executed)}</p>
        <p>no_public_qa_widget: {String(GROWTH_MEDIA_AI_QA_SAFETY_FLAGS.no_public_qa_widget)}</p>
      </div>
    </div>
  )
}
