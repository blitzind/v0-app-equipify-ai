"use client"

import React, { createContext, useContext, useReducer, useCallback } from "react"
import {
  MOCK_WORKSPACES, MOCK_USERS,
  type TenantWorkspace, type TenantUser, type UserRole,
} from "./tenant-data"
import { getPlan, type PlanId } from "./plans"
import { getWorkspaceData, type WorkspaceDataBundle } from "./workspace-data"

interface TenantState {
  workspace: TenantWorkspace
  currentUser: TenantUser
  users: TenantUser[]
}

type TenantAction =
  | { type: "SET_WORKSPACE"; payload: Partial<TenantWorkspace> }
  | { type: "SET_LOGO"; payload: string }
  | { type: "SET_COLOR"; payload: string }
  | { type: "SET_USER_ROLE"; payload: { userId: string; role: UserRole } }
  | { type: "INVITE_USER"; payload: TenantUser }
  | { type: "REMOVE_USER"; payload: string }
  | { type: "SUSPEND_USER"; payload: string }
  | { type: "UPGRADE_PLAN"; payload: { planId: PlanId; billingCycle: "monthly" | "annual" } }
  | { type: "SWITCH_WORKSPACE"; payload: string }

function reducer(state: TenantState, action: TenantAction): TenantState {
  switch (action.type) {
    case "SET_WORKSPACE":
      return { ...state, workspace: { ...state.workspace, ...action.payload } }
    case "SET_LOGO":
      return { ...state, workspace: { ...state.workspace, logoUrl: action.payload } }
    case "SET_COLOR":
      return { ...state, workspace: { ...state.workspace, primaryColor: action.payload } }
    case "SET_USER_ROLE":
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.payload.userId ? { ...u, role: action.payload.role } : u
        ),
      }
    case "INVITE_USER":
      return { ...state, users: [...state.users, action.payload] }
    case "REMOVE_USER":
      return { ...state, users: state.users.filter((u) => u.id !== action.payload) }
    case "SUSPEND_USER":
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.payload ? { ...u, status: "Suspended" } : u
        ),
      }
    case "UPGRADE_PLAN":
      return {
        ...state,
        workspace: {
          ...state.workspace,
          planId: action.payload.planId,
          billingCycle: action.payload.billingCycle,
          subscriptionStatus: "active",
        },
      }
    case "SWITCH_WORKSPACE": {
      const ws = MOCK_WORKSPACES.find((w) => w.id === action.payload)
      if (!ws) return state
      const wsUsers = MOCK_USERS.filter((u) => u.id === ws.ownerId || state.users.find((su) => su.id === u.id))
      return { workspace: ws, currentUser: MOCK_USERS.find((u) => u.id === ws.ownerId)!, users: wsUsers }
    }
    default:
      return state
  }
}

interface TenantContextValue extends TenantState {
  dispatch: React.Dispatch<TenantAction>
  plan: ReturnType<typeof getPlan>
  workspaceUsers: TenantUser[]
  workspaceData: WorkspaceDataBundle
  can: (permission: keyof typeof import("./tenant-data").ROLE_PERMISSIONS["Owner"]) => boolean
}

const TenantContext = createContext<TenantContextValue | null>(null)

const DEFAULT_WS = MOCK_WORKSPACES[0]
const DEFAULT_USER = MOCK_USERS[0]
const DEFAULT_USERS = MOCK_USERS.filter((u) =>
  ["u-01", "u-02", "u-03", "u-04", "u-05"].includes(u.id)
)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    workspace: DEFAULT_WS,
    currentUser: DEFAULT_USER,
    users: DEFAULT_USERS,
  })

  const plan = getPlan(state.workspace.planId)
  const workspaceData = getWorkspaceData(state.workspace.id)

  // Permissions map — mirrors ROLE_PERMISSIONS in tenant-data.ts
  const PERMS = {
    Owner:       { canManageWorkspace:true,  canManageBilling:true,  canManageTeam:true,  canCreateWorkOrders:true,  canEditWorkOrders:true,  canDeleteWorkOrders:true,  canCreateEquipment:true,  canEditEquipment:true,  canViewInsights:true,  canManagePlans:true,  canViewBilling:true,  canAccessPortal:true },
    Admin:       { canManageWorkspace:true,  canManageBilling:false, canManageTeam:true,  canCreateWorkOrders:true,  canEditWorkOrders:true,  canDeleteWorkOrders:true,  canCreateEquipment:true,  canEditEquipment:true,  canViewInsights:true,  canManagePlans:true,  canViewBilling:true,  canAccessPortal:true },
    Dispatcher:  { canManageWorkspace:false, canManageBilling:false, canManageTeam:false, canCreateWorkOrders:true,  canEditWorkOrders:true,  canDeleteWorkOrders:false, canCreateEquipment:true,  canEditEquipment:true,  canViewInsights:true,  canManagePlans:true,  canViewBilling:false, canAccessPortal:true },
    Technician:  { canManageWorkspace:false, canManageBilling:false, canManageTeam:false, canCreateWorkOrders:false, canEditWorkOrders:true,  canDeleteWorkOrders:false, canCreateEquipment:false, canEditEquipment:false, canViewInsights:false, canManagePlans:false, canViewBilling:false, canAccessPortal:false },
    Billing:     { canManageWorkspace:false, canManageBilling:true,  canManageTeam:false, canCreateWorkOrders:false, canEditWorkOrders:false, canDeleteWorkOrders:false, canCreateEquipment:false, canEditEquipment:false, canViewInsights:false, canManagePlans:false, canViewBilling:true,  canAccessPortal:false },
    Sales:       { canManageWorkspace:false, canManageBilling:false, canManageTeam:false, canCreateWorkOrders:true,  canEditWorkOrders:false, canDeleteWorkOrders:false, canCreateEquipment:false, canEditEquipment:false, canViewInsights:true,  canManagePlans:false, canViewBilling:false, canAccessPortal:true },
    "Read Only": { canManageWorkspace:false, canManageBilling:false, canManageTeam:false, canCreateWorkOrders:false, canEditWorkOrders:false, canDeleteWorkOrders:false, canCreateEquipment:false, canEditEquipment:false, canViewInsights:true,  canManagePlans:false, canViewBilling:false, canAccessPortal:true },
  } as const

  const can = useCallback(
    (permission: keyof typeof PERMS["Owner"]) =>
      PERMS[state.currentUser.role]?.[permission] ?? false,
    [state.currentUser.role]
  )

  return (
    <TenantContext.Provider value={{ ...state, dispatch, plan, workspaceUsers: state.users, workspaceData, can }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error("useTenant must be used within TenantProvider")
  return ctx
}

/** Convenience hook — returns the workspace-scoped demo data bundle */
export function useWorkspaceData() {
  const { workspaceData } = useTenant()
  return workspaceData
}
