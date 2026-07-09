/** GE-AIOS-13A — Build full operating rhythm from Work Manager state. */

import { evaluateApprovalCyclePhase } from "@/lib/growth/operating-rhythm/rhythms/approval-cycle"
import { evaluateInboxCyclePhase } from "@/lib/growth/operating-rhythm/rhythms/inbox-cycle"
import { evaluateMorningPlanningPhase } from "@/lib/growth/operating-rhythm/rhythms/morning-planning"
import { evaluateOutreachCyclePhase } from "@/lib/growth/operating-rhythm/rhythms/outreach-cycle"
import { evaluateQualificationCyclePhase } from "@/lib/growth/operating-rhythm/rhythms/qualification-cycle"
import { evaluateReflectionPhase } from "@/lib/growth/operating-rhythm/rhythms/reflection-cycle"
import { evaluateResearchCyclePhase } from "@/lib/growth/operating-rhythm/rhythms/research-cycle"
import {
  buildTodayPlanFromWorkManager,
  resolveCurrentPhaseFromWorkManager,
} from "@/lib/growth/operating-rhythm/bridges/work-manager-bridge"
import { buildEndOfDaySummary } from "@/lib/growth/operating-rhythm/bridges/narrative-bridge"
import {
  AVA_OPERATING_PHASE_ORDER,
  GROWTH_OPERATING_RHYTHM_QA_MARKER,
  type AvaOperatingPhaseEntry,
  type AvaOperatingPhaseId,
  type AvaOperatingRhythm,
  type AvaOperatingRhythmMemory,
  type OperatingRhythmMetrics,
  type OperatingRhythmPhaseInput,
} from "@/lib/growth/operating-rhythm/types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

export type BuildOperatingRhythmInput = {
  hour: number
  workResult: AvaWorkManagerResult
  metrics: OperatingRhythmMetrics
  sinceYesterday?: string[]
  previousMemory?: AvaOperatingRhythmMemory | null
}

function evaluateAllPhases(input: OperatingRhythmPhaseInput): AvaOperatingPhaseEntry[] {
  return [
    evaluateMorningPlanningPhase(input),
    evaluateResearchCyclePhase(input),
    evaluateQualificationCyclePhase(input),
    evaluateOutreachCyclePhase(input),
    evaluateInboxCyclePhase(input),
    evaluateApprovalCyclePhase(input),
    evaluateReflectionPhase(input),
  ]
}

function resolveNextPhase(
  timeline: AvaOperatingPhaseEntry[],
  currentPhase: AvaOperatingPhaseId,
): AvaOperatingPhaseId | null {
  const currentIndex = AVA_OPERATING_PHASE_ORDER.indexOf(currentPhase)
  for (let index = currentIndex + 1; index < AVA_OPERATING_PHASE_ORDER.length; index += 1) {
    const phaseId = AVA_OPERATING_PHASE_ORDER[index]
    const entry = timeline.find((row) => row.id === phaseId)
    if (entry && (entry.status === "pending" || entry.status === "active")) {
      return phaseId
    }
  }
  return null
}

export function buildOperatingRhythm(input: BuildOperatingRhythmInput): AvaOperatingRhythm {
  const currentPhase = resolveCurrentPhaseFromWorkManager(input.workResult, input.hour)
  const phaseInput: OperatingRhythmPhaseInput = {
    hour: input.hour,
    currentPhase,
    workResult: input.workResult,
    metrics: input.metrics,
    sinceYesterday: input.sinceYesterday ?? [],
    previousMemory: input.previousMemory ?? null,
  }

  const phase_timeline = evaluateAllPhases(phaseInput)
  const completed_phases = phase_timeline
    .filter((entry) => entry.status === "completed")
    .map((entry) => entry.id)
  const active_cycle = phase_timeline.find((entry) => entry.status === "active") ?? null
  const next_phase = resolveNextPhase(phase_timeline, currentPhase)

  const interruptions = input.workResult.interruptions.map((row) => row.reason_label)
  const waiting_on_operator = input.workResult.operator_queue.map((item) => item.title)

  const rhythmBase: AvaOperatingRhythm = {
    qaMarker: GROWTH_OPERATING_RHYTHM_QA_MARKER,
    current_phase: active_cycle?.id ?? currentPhase,
    completed_phases,
    next_phase,
    active_cycle,
    today_plan: buildTodayPlanFromWorkManager(input.workResult),
    phase_timeline,
    interruptions,
    waiting_on_operator,
    end_of_day_summary: null,
  }

  return {
    ...rhythmBase,
    end_of_day_summary: buildEndOfDaySummary(rhythmBase, input.workResult),
  }
}
