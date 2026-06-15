/** SR-3 Phase 1 — enrollment wait types (client-safe). */

import { z } from "zod"
import {
  SEQUENCE_CONDITION_EVENTS,
  SEQUENCE_CONDITION_SOURCES,
  type SequenceConditionEvent,
  type SequenceConditionSource,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"

export const SEQUENCE_ENROLLMENT_WAIT_KINDS = ["condition", "duration", "until_event"] as const

export type SequenceEnrollmentWaitKind = (typeof SEQUENCE_ENROLLMENT_WAIT_KINDS)[number]

export const SEQUENCE_ENROLLMENT_WAIT_STATUSES = [
  "pending",
  "active",
  "resolved",
  "timed_out",
  "cancelled",
] as const

export type SequenceEnrollmentWaitStatus = (typeof SEQUENCE_ENROLLMENT_WAIT_STATUSES)[number]

export const sequenceEnrollmentWaitKindSchema = z.enum(SEQUENCE_ENROLLMENT_WAIT_KINDS)
export const sequenceEnrollmentWaitStatusSchema = z.enum(SEQUENCE_ENROLLMENT_WAIT_STATUSES)

export const createSequenceEnrollmentWaitInputSchema = z
  .object({
    enrollmentId: z.string().uuid(),
    enrollmentStepId: z.string().uuid(),
    patternStepId: z.string().uuid().nullable().optional(),
    conditionId: z.string().uuid().nullable().optional(),
    waitKind: sequenceEnrollmentWaitKindSchema,
    status: sequenceEnrollmentWaitStatusSchema.optional(),
    waitedForSource: z.enum(SEQUENCE_CONDITION_SOURCES).nullable().optional(),
    waitedForEvent: z.enum(SEQUENCE_CONDITION_EVENTS).nullable().optional(),
    durationSeconds: z.number().int().min(0).max(60 * 60 * 24 * 90).nullable().optional(),
    timeoutAt: z.string().datetime().nullable().optional(),
    startedAt: z.string().datetime().nullable().optional(),
    resolutionReason: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.waitKind === "duration" && (value.durationSeconds ?? null) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duration waits require durationSeconds.",
        path: ["durationSeconds"],
      })
    }
    if (value.waitKind === "until_event") {
      if (!value.waitedForSource || !value.waitedForEvent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "until_event waits require waitedForSource and waitedForEvent.",
          path: ["waitedForEvent"],
        })
      }
    }
    if (value.waitKind === "condition" && !value.conditionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "condition waits require conditionId.",
        path: ["conditionId"],
      })
    }
  })

export const updateSequenceEnrollmentWaitInputSchema = z.object({
  status: sequenceEnrollmentWaitStatusSchema.optional(),
  waitedForSource: z.enum(SEQUENCE_CONDITION_SOURCES).nullable().optional(),
  waitedForEvent: z.enum(SEQUENCE_CONDITION_EVENTS).nullable().optional(),
  durationSeconds: z.number().int().min(0).max(60 * 60 * 24 * 90).nullable().optional(),
  timeoutAt: z.string().datetime().nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  resolvedAt: z.string().datetime().nullable().optional(),
  resolutionReason: z.string().trim().max(500).nullable().optional(),
})

export type CreateSequenceEnrollmentWaitInput = z.infer<
  typeof createSequenceEnrollmentWaitInputSchema
>

export type UpdateSequenceEnrollmentWaitInput = z.infer<
  typeof updateSequenceEnrollmentWaitInputSchema
>

export type SequenceEnrollmentWait = {
  id: string
  enrollmentId: string
  enrollmentStepId: string
  patternStepId: string | null
  conditionId: string | null
  waitKind: SequenceEnrollmentWaitKind
  status: SequenceEnrollmentWaitStatus
  waitedForSource: SequenceConditionSource | null
  waitedForEvent: SequenceConditionEvent | null
  durationSeconds: number | null
  timeoutAt: string | null
  startedAt: string | null
  resolvedAt: string | null
  resolutionReason: string | null
  createdAt: string
  updatedAt: string
}

export function validateSequenceEnrollmentWaitStatus(
  status: unknown,
): { ok: true; status: SequenceEnrollmentWaitStatus } | { ok: false; code: string; message: string } {
  const parsed = sequenceEnrollmentWaitStatusSchema.safeParse(status)
  if (parsed.success) return { ok: true, status: parsed.data }
  return { ok: false, code: "invalid_wait_status", message: "Invalid enrollment wait status." }
}

export function isTerminalEnrollmentWaitStatus(status: SequenceEnrollmentWaitStatus): boolean {
  return status === "resolved" || status === "timed_out" || status === "cancelled"
}
