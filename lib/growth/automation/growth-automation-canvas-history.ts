/** Growth Engine S5-C — undo/redo history (client-safe). */

import { cloneCanvasState } from "@/lib/growth/automation/growth-automation-canvas-utils"
import type { AutomationCanvasEdge, AutomationCanvasNode } from "@/lib/growth/automation/growth-automation-canvas-types"

export type GrowthAutomationCanvasHistorySnapshot = {
  nodes: AutomationCanvasNode[]
  edges: AutomationCanvasEdge[]
}

export type GrowthAutomationCanvasHistoryState = {
  past: GrowthAutomationCanvasHistorySnapshot[]
  present: GrowthAutomationCanvasHistorySnapshot
  future: GrowthAutomationCanvasHistorySnapshot[]
}

const MAX_HISTORY = 50

export function createHistoryState(
  snapshot: GrowthAutomationCanvasHistorySnapshot,
): GrowthAutomationCanvasHistoryState {
  return {
    past: [],
    present: cloneCanvasState(snapshot),
    future: [],
  }
}

export function pushHistoryState(
  state: GrowthAutomationCanvasHistoryState,
  snapshot: GrowthAutomationCanvasHistorySnapshot,
): GrowthAutomationCanvasHistoryState {
  const past = [...state.past, cloneCanvasState(state.present)].slice(-MAX_HISTORY)
  return {
    past,
    present: cloneCanvasState(snapshot),
    future: [],
  }
}

export function undoHistoryState(
  state: GrowthAutomationCanvasHistoryState,
): GrowthAutomationCanvasHistoryState {
  if (state.past.length === 0) return state
  const previous = state.past[state.past.length - 1]!
  return {
    past: state.past.slice(0, -1),
    present: cloneCanvasState(previous),
    future: [cloneCanvasState(state.present), ...state.future],
  }
}

export function redoHistoryState(
  state: GrowthAutomationCanvasHistoryState,
): GrowthAutomationCanvasHistoryState {
  if (state.future.length === 0) return state
  const next = state.future[0]!
  return {
    past: [...state.past, cloneCanvasState(state.present)],
    present: cloneCanvasState(next),
    future: state.future.slice(1),
  }
}

export function canUndoHistory(state: GrowthAutomationCanvasHistoryState): boolean {
  return state.past.length > 0
}

export function canRedoHistory(state: GrowthAutomationCanvasHistoryState): boolean {
  return state.future.length > 0
}
