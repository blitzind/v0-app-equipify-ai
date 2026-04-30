"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { workOrders as initialData } from "@/lib/mock-data"
import type { WorkOrder, WorkOrderStatus, RepairLog } from "@/lib/mock-data"
import { useWorkspaceData } from "@/lib/tenant-store"

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  workOrders: WorkOrder[]
}

type Action =
  | { type: "CREATE"; payload: WorkOrder }
  | { type: "UPDATE_STATUS"; id: string; status: WorkOrderStatus }
  | { type: "UPDATE_REPAIR_LOG"; id: string; repairLog: Partial<RepairLog> }
  | { type: "UPDATE_WORK_ORDER"; id: string; payload: Partial<WorkOrder> }
  | { type: "REORDER_KANBAN"; id: string; status: WorkOrderStatus; index: number }
  | { type: "RESET"; workOrders: WorkOrder[] }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "CREATE":
      return { ...state, workOrders: [action.payload, ...state.workOrders] }

    case "UPDATE_STATUS":
      return {
        ...state,
        workOrders: state.workOrders.map((wo) =>
          wo.id === action.id ? { ...wo, status: action.status } : wo
        ),
      }

    case "UPDATE_REPAIR_LOG":
      return {
        ...state,
        workOrders: state.workOrders.map((wo) =>
          wo.id === action.id
            ? { ...wo, repairLog: { ...wo.repairLog, ...action.repairLog } }
            : wo
        ),
      }

    case "UPDATE_WORK_ORDER":
      return {
        ...state,
        workOrders: state.workOrders.map((wo) =>
          wo.id === action.id ? { ...wo, ...action.payload } : wo
        ),
      }

    case "RESET":
      return { workOrders: action.workOrders }
    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface WorkOrderContextValue {
  workOrders: WorkOrder[]
  createWorkOrder: (wo: WorkOrder) => void
  updateStatus: (id: string, status: WorkOrderStatus) => void
  updateRepairLog: (id: string, repairLog: Partial<RepairLog>) => void
  updateWorkOrder: (id: string, payload: Partial<WorkOrder>) => void
  getById: (id: string) => WorkOrder | undefined
}

const WorkOrderContext = createContext<WorkOrderContextValue | null>(null)

export function WorkOrderProvider({ children }: { children: ReactNode }) {
  const { workOrders: wsWorkOrders } = useWorkspaceData()
  const [state, dispatch] = useReducer(reducer, { workOrders: wsWorkOrders })

  useEffect(() => {
    dispatch({ type: "RESET", workOrders: wsWorkOrders })
  }, [wsWorkOrders])

  const createWorkOrder = useCallback(
    (wo: WorkOrder) => dispatch({ type: "CREATE", payload: wo }),
    []
  )
  const updateStatus = useCallback(
    (id: string, status: WorkOrderStatus) =>
      dispatch({ type: "UPDATE_STATUS", id, status }),
    []
  )
  const updateRepairLog = useCallback(
    (id: string, repairLog: Partial<RepairLog>) =>
      dispatch({ type: "UPDATE_REPAIR_LOG", id, repairLog }),
    []
  )
  const updateWorkOrder = useCallback(
    (id: string, payload: Partial<WorkOrder>) =>
      dispatch({ type: "UPDATE_WORK_ORDER", id, payload }),
    []
  )
  const getById = useCallback(
    (id: string) => state.workOrders.find((wo) => wo.id === id),
    [state.workOrders]
  )

  return (
    <WorkOrderContext.Provider
      value={{
        workOrders: state.workOrders,
        createWorkOrder,
        updateStatus,
        updateRepairLog,
        updateWorkOrder,
        getById,
      }}
    >
      {children}
    </WorkOrderContext.Provider>
  )
}

export function useWorkOrders() {
  const ctx = useContext(WorkOrderContext)
  if (!ctx) throw new Error("useWorkOrders must be used inside WorkOrderProvider")
  return ctx
}
