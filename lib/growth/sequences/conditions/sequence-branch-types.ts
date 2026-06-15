/** SR-3 Phase 1 — sequence branch edge + decision types (client-safe). */

import { z } from "zod"
import {
  SEQUENCE_CONDITION_EVENTS,
  SEQUENCE_CONDITION_SOURCES,
  type SequenceConditionEvent,
  type SequenceConditionSource,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"

export const SEQUENCE_BRANCH_EDGE_TYPES = [
  "default",
  "conditional_true",
  "conditional_false",
  "timeout",
  "fallback",
] as const

export type SequenceBranchEdgeType = (typeof SEQUENCE_BRANCH_EDGE_TYPES)[number]

export const SEQUENCE_BRANCH_DECISIONS = ["true", "false", "timeout", "skipped"] as const

export type SequenceBranchDecisionOutcome = (typeof SEQUENCE_BRANCH_DECISIONS)[number]

export const sequenceBranchEdgeTypeSchema = z.enum(SEQUENCE_BRANCH_EDGE_TYPES)

export const createSequenceBranchEdgeInputSchema = z.object({
  patternId: z.string().uuid(),
  fromPatternStepId: z.string().uuid(),
  toPatternStepId: z.string().uuid(),
  edgeType: sequenceBranchEdgeTypeSchema,
  conditionId: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  label: z.string().trim().max(160).nullable().optional(),
})

export const updateSequenceBranchEdgeInputSchema = z.object({
  toPatternStepId: z.string().uuid().optional(),
  edgeType: sequenceBranchEdgeTypeSchema.optional(),
  conditionId: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  label: z.string().trim().max(160).nullable().optional(),
})

export type CreateSequenceBranchEdgeInput = z.infer<typeof createSequenceBranchEdgeInputSchema>

export type UpdateSequenceBranchEdgeInput = z.infer<typeof updateSequenceBranchEdgeInputSchema>

export type SequenceBranchEdge = {
  id: string
  patternId: string
  fromPatternStepId: string
  toPatternStepId: string
  conditionId: string | null
  edgeType: SequenceBranchEdgeType
  priority: number
  label: string | null
  createdAt: string
  updatedAt: string
}

export const appendSequenceBranchDecisionInputSchema = z.object({
  enrollmentId: z.string().uuid(),
  enrollmentStepId: z.string().uuid().nullable().optional(),
  patternStepId: z.string().uuid().nullable().optional(),
  conditionId: z.string().uuid().nullable().optional(),
  edgeId: z.string().uuid().nullable().optional(),
  decision: z.enum(SEQUENCE_BRANCH_DECISIONS),
  dslVersion: z.literal(1).default(1),
  source: z.enum(SEQUENCE_CONDITION_SOURCES),
  event: z.enum(SEQUENCE_CONDITION_EVENTS),
  outcomeDetail: z.string().trim().max(500).nullable().optional(),
  evaluatedAt: z.string().datetime().optional(),
})

export type AppendSequenceBranchDecisionInput = z.infer<
  typeof appendSequenceBranchDecisionInputSchema
>

export type SequenceBranchDecision = {
  id: string
  enrollmentId: string
  enrollmentStepId: string | null
  patternStepId: string | null
  conditionId: string | null
  edgeId: string | null
  decision: SequenceBranchDecisionOutcome
  dslVersion: number
  source: SequenceConditionSource
  event: SequenceConditionEvent
  outcomeDetail: string | null
  evaluatedAt: string
  createdAt: string
}

export function validateSequenceBranchEdgeType(
  edgeType: unknown,
): { ok: true; edgeType: SequenceBranchEdgeType } | { ok: false; code: string; message: string } {
  const parsed = sequenceBranchEdgeTypeSchema.safeParse(edgeType)
  if (parsed.success) return { ok: true, edgeType: parsed.data }
  return { ok: false, code: "invalid_edge_type", message: "Invalid branch edge type." }
}

export function requiresConditionForEdgeType(edgeType: SequenceBranchEdgeType): boolean {
  return edgeType === "conditional_true" || edgeType === "conditional_false"
}
