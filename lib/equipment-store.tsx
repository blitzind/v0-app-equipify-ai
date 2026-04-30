"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react"
import { equipment as initialData } from "@/lib/mock-data"
import type { Equipment } from "@/lib/mock-data"

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  equipment: Equipment[]
}

type Action =
  | { type: "ADD"; payload: Equipment }
  | { type: "UPDATE"; id: string; payload: Partial<Equipment> }
  | { type: "REMOVE"; id: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD":
      return { ...state, equipment: [action.payload, ...state.equipment] }
    case "UPDATE":
      return {
        ...state,
        equipment: state.equipment.map((e) =>
          e.id === action.id ? { ...e, ...action.payload } : e
        ),
      }
    case "REMOVE":
      return { ...state, equipment: state.equipment.filter((e) => e.id !== action.id) }
    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface EquipmentContextValue {
  equipment: Equipment[]
  addEquipment: (e: Equipment) => void
  updateEquipment: (id: string, payload: Partial<Equipment>) => void
  removeEquipment: (id: string) => void
  getById: (id: string) => Equipment | undefined
}

const EquipmentContext = createContext<EquipmentContextValue | null>(null)

export function EquipmentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { equipment: initialData })

  const addEquipment = useCallback(
    (e: Equipment) => dispatch({ type: "ADD", payload: e }),
    []
  )
  const updateEquipment = useCallback(
    (id: string, payload: Partial<Equipment>) =>
      dispatch({ type: "UPDATE", id, payload }),
    []
  )
  const removeEquipment = useCallback(
    (id: string) => dispatch({ type: "REMOVE", id }),
    []
  )
  const getById = useCallback(
    (id: string) => state.equipment.find((e) => e.id === id),
    [state.equipment]
  )

  return (
    <EquipmentContext.Provider
      value={{ equipment: state.equipment, addEquipment, updateEquipment, removeEquipment, getById }}
    >
      {children}
    </EquipmentContext.Provider>
  )
}

export function useEquipment() {
  const ctx = useContext(EquipmentContext)
  if (!ctx) throw new Error("useEquipment must be used inside EquipmentProvider")
  return ctx
}
