/** SR-3 Phase 1 — structured sequence condition DSL (client-safe). */

import { z } from "zod"

export const GROWTH_SEQUENCE_CONDITIONS_QA_MARKER =
  "growth-sequence-conditions-sr3-phase1-v1" as const

export const GROWTH_SEQUENCE_CONDITIONS_MIGRATION =
  "20270827120000_growth_sequence_conditions_sr3_phase1.sql" as const

export const GROWTH_SEQUENCE_BRANCH_EVALUATED_TIMELINE_MIGRATION =
  "20270827120100_growth_sequence_branch_evaluated_timeline_sr3.sql" as const

export const GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION =
  "20270827120900_growth_sequence_trigger_runtime_s3a.sql" as const

export const GROWTH_SEQUENCE_CONDITIONS_CONFIRM =
  "RUN_GROWTH_SEQUENCE_CONDITIONS_CERTIFICATION" as const

export const SEQUENCE_CONDITION_DSL_VERSION = 1 as const

export const SEQUENCE_CONDITION_SOURCES = [
  "email",
  "share_page",
  "sms",
  "voice_drop",
  "cadence",
  "lead",
  "engagement",
  "media",
  "booking_handoff",
  "high_intent",
] as const

export type SequenceConditionSource = (typeof SEQUENCE_CONDITION_SOURCES)[number]

export const SEQUENCE_CONDITION_COMPARE_OPERATORS = [
  "eq",
  "neq",
  "gte",
  "lte",
  "gt",
  "lt",
] as const

export type SequenceConditionCompareOperator =
  (typeof SEQUENCE_CONDITION_COMPARE_OPERATORS)[number]

export const SEQUENCE_CONDITION_EVENTS = [
  "email.opened",
  "email.clicked",
  "email.replied",
  "email.bounced",
  "share_page.viewed",
  "share_page.engaged",
  "share_page.cta_clicked",
  "share_page.booking_started",
  "share_page.booking_completed",
  "sms.delivered",
  "sms.replied",
  "sms.failed",
  "voice_drop.delivered",
  "voice_drop.failed",
  "call_task.completed",
  "lead.status",
  "lead.hot_tier",
  "lead.next_best_action",
  "engagement.score_threshold",
  "engagement.tier",
  "media.viewed",
  "media.play_started",
  "media.completed",
  "media.cta_clicked",
  "booking_handoff.ready",
  "high_intent.detected",
] as const

export type SequenceConditionEvent = (typeof SEQUENCE_CONDITION_EVENTS)[number]

export const SEQUENCE_CONDITION_EVENT_TO_SOURCE: Record<
  SequenceConditionEvent,
  SequenceConditionSource
> = {
  "email.opened": "email",
  "email.clicked": "email",
  "email.replied": "email",
  "email.bounced": "email",
  "share_page.viewed": "share_page",
  "share_page.engaged": "share_page",
  "share_page.cta_clicked": "share_page",
  "share_page.booking_started": "share_page",
  "share_page.booking_completed": "share_page",
  "sms.delivered": "sms",
  "sms.replied": "sms",
  "sms.failed": "sms",
  "voice_drop.delivered": "voice_drop",
  "voice_drop.failed": "voice_drop",
  "call_task.completed": "cadence",
  "lead.status": "lead",
  "lead.hot_tier": "lead",
  "lead.next_best_action": "lead",
  "engagement.score_threshold": "engagement",
  "engagement.tier": "engagement",
  "media.viewed": "media",
  "media.play_started": "media",
  "media.completed": "media",
  "media.cta_clicked": "media",
  "booking_handoff.ready": "booking_handoff",
  "high_intent.detected": "high_intent",
}

const dslVersionSchema = z.literal(SEQUENCE_CONDITION_DSL_VERSION)
const operatorSchema = z.enum(SEQUENCE_CONDITION_COMPARE_OPERATORS)

const leadStatusSpecSchema = z
  .object({
    dslVersion: dslVersionSchema,
    source: z.literal("lead"),
    event: z.literal("lead.status"),
    statusValue: z.string().trim().min(1).max(80),
  })
  .strict()

const leadHotTierSpecSchema = z
  .object({
    dslVersion: dslVersionSchema,
    source: z.literal("lead"),
    event: z.literal("lead.hot_tier"),
    tierValue: z.string().trim().min(1).max(80),
  })
  .strict()

const leadNextBestActionSpecSchema = z
  .object({
    dslVersion: dslVersionSchema,
    source: z.literal("lead"),
    event: z.literal("lead.next_best_action"),
    actionValue: z.string().trim().min(1).max(80),
  })
  .strict()

const engagementScoreThresholdSpecSchema = z
  .object({
    dslVersion: dslVersionSchema,
    source: z.literal("engagement"),
    event: z.literal("engagement.score_threshold"),
    operator: operatorSchema,
    threshold: z.number().finite().min(0),
  })
  .strict()

const engagementTierSpecSchema = z
  .object({
    dslVersion: dslVersionSchema,
    source: z.literal("engagement"),
    event: z.literal("engagement.tier"),
    tierValue: z.string().trim().min(1).max(80),
  })
  .strict()

export const sequenceConditionSpecSchema = z
  .discriminatedUnion("event", [
    leadStatusSpecSchema,
    leadHotTierSpecSchema,
    leadNextBestActionSpecSchema,
    engagementScoreThresholdSpecSchema,
    engagementTierSpecSchema,
    ...([
      "email.opened",
      "email.clicked",
      "email.replied",
      "email.bounced",
      "share_page.viewed",
      "share_page.engaged",
      "share_page.cta_clicked",
      "share_page.booking_started",
      "share_page.booking_completed",
      "sms.delivered",
      "sms.replied",
      "sms.failed",
      "voice_drop.delivered",
      "voice_drop.failed",
      "call_task.completed",
      "media.viewed",
      "media.play_started",
      "media.completed",
      "media.cta_clicked",
      "booking_handoff.ready",
      "high_intent.detected",
    ] as const).map((event) =>
      z
        .object({
          dslVersion: dslVersionSchema,
          source: z.literal(SEQUENCE_CONDITION_EVENT_TO_SOURCE[event]),
          event: z.literal(event),
        })
        .strict(),
    ),
  ])
  .superRefine((value, ctx) => {
    if (SEQUENCE_CONDITION_EVENT_TO_SOURCE[value.event] !== value.source) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Event ${value.event} requires source ${SEQUENCE_CONDITION_EVENT_TO_SOURCE[value.event]}.`,
        path: ["source"],
      })
    }
  })

export type SequenceConditionSpec = z.infer<typeof sequenceConditionSpecSchema>

export type SequenceConditionValidationResult =
  | { ok: true; spec: SequenceConditionSpec }
  | { ok: false; code: string; message: string }

export function parseSequenceConditionSpec(input: unknown): SequenceConditionValidationResult {
  const parsed = sequenceConditionSpecSchema.safeParse(input)
  if (parsed.success) return { ok: true, spec: parsed.data }
  const message = parsed.error.issues.map((issue) => issue.message).join("; ")
  return { ok: false, code: "invalid_condition_spec", message: message || "Invalid condition spec." }
}

export type SequencePatternStepCondition = {
  id: string
  patternStepId: string
  conditionKey: string
  spec: SequenceConditionSpec
  label: string | null
  createdAt: string
  updatedAt: string
}

export type CreateSequenceConditionInput = {
  patternStepId: string
  conditionKey: string
  spec: SequenceConditionSpec
  label?: string | null
  durationSeconds?: number | null
}

export type UpdateSequenceConditionInput = {
  conditionKey?: string
  spec?: SequenceConditionSpec
  label?: string | null
  durationSeconds?: number | null
}

export function conditionSpecToPersistenceFields(spec: SequenceConditionSpec): {
  dsl_version: number
  source: SequenceConditionSource
  event: SequenceConditionEvent
  compare_operator: SequenceConditionCompareOperator | null
  string_value: string | null
  number_value: number | null
  boolean_value: boolean | null
} {
  switch (spec.event) {
    case "lead.status":
      return {
        dsl_version: spec.dslVersion,
        source: spec.source,
        event: spec.event,
        compare_operator: null,
        string_value: spec.statusValue,
        number_value: null,
        boolean_value: null,
      }
    case "lead.hot_tier":
      return {
        dsl_version: spec.dslVersion,
        source: spec.source,
        event: spec.event,
        compare_operator: null,
        string_value: spec.tierValue,
        number_value: null,
        boolean_value: null,
      }
    case "lead.next_best_action":
      return {
        dsl_version: spec.dslVersion,
        source: spec.source,
        event: spec.event,
        compare_operator: null,
        string_value: spec.actionValue,
        number_value: null,
        boolean_value: null,
      }
    case "engagement.score_threshold":
      return {
        dsl_version: spec.dslVersion,
        source: spec.source,
        event: spec.event,
        compare_operator: spec.operator,
        string_value: null,
        number_value: spec.threshold,
        boolean_value: null,
      }
    case "engagement.tier":
      return {
        dsl_version: spec.dslVersion,
        source: spec.source,
        event: spec.event,
        compare_operator: null,
        string_value: spec.tierValue,
        number_value: null,
        boolean_value: null,
      }
    default:
      return {
        dsl_version: spec.dslVersion,
        source: spec.source,
        event: spec.event,
        compare_operator: null,
        string_value: null,
        number_value: null,
        boolean_value: null,
      }
  }
}

export function conditionRowToSpec(row: {
  dsl_version: number
  source: SequenceConditionSource
  event: SequenceConditionEvent
  compare_operator: SequenceConditionCompareOperator | null
  string_value: string | null
  number_value: number | null
}): SequenceConditionSpec {
  const base = { dslVersion: SEQUENCE_CONDITION_DSL_VERSION as 1, source: row.source }

  switch (row.event) {
    case "lead.status":
      return { ...base, event: row.event, statusValue: row.string_value ?? "" }
    case "lead.hot_tier":
      return { ...base, event: row.event, tierValue: row.string_value ?? "" }
    case "lead.next_best_action":
      return { ...base, event: row.event, actionValue: row.string_value ?? "" }
    case "engagement.score_threshold":
      return {
        ...base,
        event: row.event,
        operator: row.compare_operator ?? "gte",
        threshold: Number(row.number_value ?? 0),
      }
    case "engagement.tier":
      return { ...base, event: row.event, tierValue: row.string_value ?? "" }
    default:
      return { ...base, event: row.event }
  }
}
