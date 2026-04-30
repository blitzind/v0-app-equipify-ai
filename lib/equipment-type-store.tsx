"use client"

import { createContext, useContext, useReducer, type ReactNode } from "react"
import { equipment as allEquipment } from "@/lib/mock-data"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EquipmentType {
  id: string
  name: string
  color: string    // hex
  icon: string     // lucide icon name (used as a key to look up)
  description: string
  usageCount: number
  isDefault: boolean
}

type Action =
  | { type: "ADD";    payload: Omit<EquipmentType, "id" | "usageCount" | "isDefault"> }
  | { type: "UPDATE"; payload: { id: string } & Partial<Omit<EquipmentType, "id">> }
  | { type: "DELETE"; payload: { id: string } }

// ─── Seed data ────────────────────────────────────────────────────────────────

// Count how many equipment records belong to each category
function countByCategory(name: string): number {
  return allEquipment.filter((e) => e.category === name).length
}

const DEFAULT_TYPES: EquipmentType[] = [
  {
    id: "et-001",
    name: "HVAC",
    color: "#2563eb",
    icon: "Thermometer",
    description: "Heating, ventilation, and air-conditioning units.",
    usageCount: countByCategory("HVAC"),
    isDefault: true,
  },
  {
    id: "et-002",
    name: "Refrigeration",
    color: "#0891b2",
    icon: "Snowflake",
    description: "Walk-in coolers, freezers, and reach-in units.",
    usageCount: countByCategory("Refrigeration"),
    isDefault: true,
  },
  {
    id: "et-003",
    name: "Electrical",
    color: "#d97706",
    icon: "Zap",
    description: "Panels, transformers, and electrical distribution.",
    usageCount: countByCategory("Electrical"),
    isDefault: true,
  },
  {
    id: "et-004",
    name: "Plumbing",
    color: "#0f766e",
    icon: "Droplets",
    description: "Boilers, water heaters, and pipe systems.",
    usageCount: countByCategory("Plumbing"),
    isDefault: true,
  },
  {
    id: "et-005",
    name: "Kitchen Equipment",
    color: "#dc2626",
    icon: "UtensilsCrossed",
    description: "Commercial ovens, fryers, dishwashers, and ranges.",
    usageCount: countByCategory("Kitchen Equipment"),
    isDefault: true,
  },
  {
    id: "et-006",
    name: "Fire Safety",
    color: "#ea580c",
    icon: "Flame",
    description: "Suppression systems, extinguishers, and alarms.",
    usageCount: countByCategory("Fire Safety"),
    isDefault: true,
  },
  {
    id: "et-007",
    name: "Generators",
    color: "#7c3aed",
    icon: "CircuitBoard",
    description: "Standby and portable generator units.",
    usageCount: countByCategory("Generators"),
    isDefault: true,
  },
  {
    id: "et-008",
    name: "Elevators",
    color: "#475569",
    icon: "ArrowUpDown",
    description: "Passenger and freight elevator equipment.",
    usageCount: countByCategory("Elevators"),
    isDefault: true,
  },
]

// ─── Reducer ──────────────────────────────────────────────────────────────────

let nextId = DEFAULT_TYPES.length + 1

function reducer(state: EquipmentType[], action: Action): EquipmentType[] {
  switch (action.type) {
    case "ADD":
      return [
        ...state,
        {
          ...action.payload,
          id: `et-${String(nextId++).padStart(3, "0")}`,
          usageCount: 0,
          isDefault: false,
        },
      ]
    case "UPDATE":
      return state.map((t) =>
        t.id === action.payload.id ? { ...t, ...action.payload } : t
      )
    case "DELETE":
      return state.filter((t) => t.id !== action.payload.id)
    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface Ctx {
  types: EquipmentType[]
  dispatch: React.Dispatch<Action>
}

const EquipmentTypeContext = createContext<Ctx | null>(null)

export function EquipmentTypeProvider({ children }: { children: ReactNode }) {
  const [types, dispatch] = useReducer(reducer, DEFAULT_TYPES)
  return (
    <EquipmentTypeContext.Provider value={{ types, dispatch }}>
      {children}
    </EquipmentTypeContext.Provider>
  )
}

export function useEquipmentTypes() {
  const ctx = useContext(EquipmentTypeContext)
  if (!ctx) throw new Error("useEquipmentTypes must be used inside EquipmentTypeProvider")
  return ctx
}

// ─── Available icons for picker ───────────────────────────────────────────────

export const ICON_OPTIONS = [
  "Thermometer", "Snowflake", "Zap", "Droplets", "UtensilsCrossed",
  "Flame", "CircuitBoard", "ArrowUpDown", "Wrench", "Settings",
  "Wind", "Gauge", "Lightbulb", "Radio", "Cpu", "Server",
  "ShieldCheck", "AlertTriangle", "Power", "PcCase",
] as const

export type IconName = (typeof ICON_OPTIONS)[number]

// ─── Color presets ────────────────────────────────────────────────────────────

export const COLOR_PRESETS = [
  "#2563eb", // blue
  "#0891b2", // cyan
  "#0f766e", // teal
  "#16a34a", // green
  "#d97706", // amber
  "#dc2626", // red
  "#ea580c", // orange
  "#7c3aed", // violet (allowed for non-AI use)
  "#db2777", // pink
  "#475569", // slate
]
