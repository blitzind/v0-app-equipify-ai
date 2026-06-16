"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import {
  canRedoHistory,
  canUndoHistory,
  createHistoryState,
  pushHistoryState,
  redoHistoryState,
  undoHistoryState,
  type GrowthAutomationCanvasHistorySnapshot,
  type GrowthAutomationCanvasHistoryState,
} from "@/lib/growth/automation/growth-automation-canvas-history"

type HistoryContextValue = {
  snapshot: GrowthAutomationCanvasHistorySnapshot
  setSnapshot: (next: GrowthAutomationCanvasHistorySnapshot, recordHistory?: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const GrowthAutomationHistoryContext = createContext<HistoryContextValue | null>(null)

export function GrowthAutomationHistoryProvider({
  initialSnapshot,
  children,
}: {
  initialSnapshot: GrowthAutomationCanvasHistorySnapshot
  children: ReactNode
}) {
  const [history, setHistory] = useState<GrowthAutomationCanvasHistoryState>(() =>
    createHistoryState(initialSnapshot),
  )

  const setSnapshot = useCallback((next: GrowthAutomationCanvasHistorySnapshot, recordHistory = true) => {
    setHistory((current) => (recordHistory ? pushHistoryState(current, next) : { ...current, present: next }))
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => undoHistoryState(current))
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => redoHistoryState(current))
  }, [])

  const value = useMemo(
    () => ({
      snapshot: history.present,
      setSnapshot,
      undo,
      redo,
      canUndo: canUndoHistory(history),
      canRedo: canRedoHistory(history),
    }),
    [history, redo, setSnapshot, undo],
  )

  return (
    <GrowthAutomationHistoryContext.Provider value={value}>{children}</GrowthAutomationHistoryContext.Provider>
  )
}

export function useGrowthAutomationHistory(): HistoryContextValue {
  const context = useContext(GrowthAutomationHistoryContext)
  if (!context) throw new Error("useGrowthAutomationHistory requires GrowthAutomationHistoryProvider")
  return context
}
