"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { customers as initialData } from "@/lib/mock-data"
import type { Customer, Location } from "@/lib/mock-data"
import { useWorkspaceData } from "@/lib/tenant-store"

interface State {
  customers: Customer[]
}

type Action =
  | { type: "ADD"; payload: Customer }
  | { type: "UPDATE"; id: string; payload: Partial<Customer> }
  | { type: "ADD_LOCATION"; customerId: string; location: Location }
  | { type: "RESET"; customers: Customer[] }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD":
      return { ...state, customers: [action.payload, ...state.customers] }
    case "UPDATE":
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.id ? { ...c, ...action.payload } : c
        ),
      }
    case "ADD_LOCATION":
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.customerId
            ? { ...c, locations: [...c.locations, action.location] }
            : c
        ),
      }
    case "RESET":
      return { customers: action.customers }
    default:
      return state
  }
}

interface CustomerContextValue {
  customers: Customer[]
  addCustomer: (c: Customer) => void
  updateCustomer: (id: string, payload: Partial<Customer>) => void
  addLocation: (customerId: string, location: Location) => void
  getById: (id: string) => Customer | undefined
}

const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: ReactNode }) {
  const { customers: wsCustomers } = useWorkspaceData()
  const [state, dispatch] = useReducer(reducer, { customers: wsCustomers })

  useEffect(() => {
    dispatch({ type: "RESET", customers: wsCustomers })
  }, [wsCustomers])

  const addCustomer = useCallback((c: Customer) => dispatch({ type: "ADD", payload: c }), [])
  const updateCustomer = useCallback((id: string, payload: Partial<Customer>) => dispatch({ type: "UPDATE", id, payload }), [])
  const addLocation = useCallback((customerId: string, location: Location) => dispatch({ type: "ADD_LOCATION", customerId, location }), [])
  const getById = useCallback((id: string) => state.customers.find((c) => c.id === id), [state.customers])

  return (
    <CustomerContext.Provider value={{ customers: state.customers, addCustomer, updateCustomer, addLocation, getById }}>
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomers() {
  const ctx = useContext(CustomerContext)
  if (!ctx) throw new Error("useCustomers must be used inside CustomerProvider")
  return ctx
}
