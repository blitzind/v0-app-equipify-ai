"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type POStatus =
  | "Draft"
  | "Sent"
  | "Approved"
  | "Ordered"
  | "Partially Received"
  | "Received"
  | "Closed"

export interface POLineItem {
  description: string
  qty: number
  unitCost: number
}

export interface PurchaseOrder {
  id: string
  vendor: string
  vendorEmail?: string
  shipTo: string
  billTo: string
  status: POStatus
  orderedDate: string
  eta: string
  amount: number
  workOrderId?: string
  customerId?: string
  customerName?: string
  notes: string
  lineItems: POLineItem[]
  attachments: string[]
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "PO-1042",
    vendor: "Grainger Industrial",
    vendorEmail: "orders@grainger.com",
    shipTo: "123 Service Center Dr, Chicago IL 60601",
    billTo: "Equipify Field Ops, 456 Main St, Chicago IL 60601",
    status: "Ordered",
    orderedDate: "2025-04-18",
    eta: "2025-04-28",
    amount: 3840,
    workOrderId: "WO-2039",
    customerId: "CUS-003",
    customerName: "Metro Warehousing",
    notes: "Rush order — HVAC compressor needed for warehouse refrigeration system.",
    lineItems: [
      { description: "Carrier 38CKC036340 Compressor", qty: 1, unitCost: 2850 },
      { description: "Refrigerant R-410A (25 lb)", qty: 2, unitCost: 220 },
      { description: "Capacitor Kit (start/run)", qty: 1, unitCost: 85 },
      { description: "Contactor 30A 24V Coil", qty: 2, unitCost: 42 },
      { description: "Shipping & Handling", qty: 1, unitCost: 160 },
    ],
    attachments: [],
  },
  {
    id: "PO-1041",
    vendor: "Motion Industries",
    vendorEmail: "procurement@motion.com",
    shipTo: "900 Industrial Pkwy, Detroit MI 48201",
    billTo: "Equipify Field Ops, 456 Main St, Chicago IL 60601",
    status: "Received",
    orderedDate: "2025-04-10",
    eta: "2025-04-17",
    amount: 1920,
    workOrderId: "WO-1995",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    notes: "CNC spindle bearing replacement parts.",
    lineItems: [
      { description: "FAG 6007-2RSR Deep Groove Bearing", qty: 4, unitCost: 185 },
      { description: "SKF LGWA 2 Bearing Grease (400g)", qty: 2, unitCost: 48 },
      { description: "Spindle Lock Nut M45 x 1.5", qty: 2, unitCost: 94 },
      { description: "Freight", qty: 1, unitCost: 75 },
    ],
    attachments: [],
  },
  {
    id: "PO-1040",
    vendor: "W.W. Grainger",
    vendorEmail: "orders@grainger.com",
    shipTo: "7800 Commerce Blvd, Sacramento CA 95828",
    billTo: "Equipify Field Ops, 456 Main St, Chicago IL 60601",
    status: "Partially Received",
    orderedDate: "2025-04-14",
    eta: "2025-04-25",
    amount: 5620,
    workOrderId: "WO-2036",
    customerId: "CUS-004",
    customerName: "Summit Construction",
    notes: "Track link assembly and hydraulic fittings for excavator repair.",
    lineItems: [
      { description: "Cat 320 Track Link Assembly (per link)", qty: 8, unitCost: 445 },
      { description: "Hydraulic O-Ring Kit", qty: 3, unitCost: 72 },
      { description: "Parker 1/2\" JIC Hydraulic Fittings (10pk)", qty: 4, unitCost: 38 },
      { description: "Machine Bolt Kit M16 x 80mm", qty: 2, unitCost: 55 },
      { description: "Freight (heavy items)", qty: 1, unitCost: 290 },
    ],
    attachments: [],
  },
  {
    id: "PO-1039",
    vendor: "Fastenal Company",
    vendorEmail: "sales@fastenal.com",
    shipTo: "2200 Industrial Way, Denver CO 80216",
    billTo: "Equipify Field Ops, 456 Main St, Chicago IL 60601",
    status: "Approved",
    orderedDate: "2025-04-20",
    eta: "2025-04-27",
    amount: 880,
    workOrderId: "WO-2025",
    customerId: "CUS-005",
    customerName: "Clearfield Foods",
    notes: "Refrigeration door gaskets and seals for walk-in cooler repair.",
    lineItems: [
      { description: "Heatcraft Door Gasket 36\" x 78\"", qty: 4, unitCost: 95 },
      { description: "Foam Backer Rod 3/8\" (50ft roll)", qty: 3, unitCost: 28 },
      { description: "Silicone Sealant (Clear, 10oz)", qty: 6, unitCost: 18 },
      { description: "Shipping", qty: 1, unitCost: 45 },
    ],
    attachments: [],
  },
  {
    id: "PO-1038",
    vendor: "MSC Industrial Direct",
    vendorEmail: "orders@mscdirect.com",
    shipTo: "555 Logistics Way, Cincinnati OH 45201",
    billTo: "Equipify Field Ops, 456 Main St, Chicago IL 60601",
    status: "Sent",
    orderedDate: "2025-04-22",
    eta: "2025-05-02",
    amount: 2340,
    workOrderId: "WO-1980",
    customerId: "CUS-001",
    customerName: "Riverstone Logistics",
    notes: "Forklift mast chain and hydraulic pump for scheduled PM.",
    lineItems: [
      { description: "Toyota Forklift Mast Chain Assembly", qty: 2, unitCost: 685 },
      { description: "Hydraulic Pump 14 GPM 2-Stage", qty: 1, unitCost: 590 },
      { description: "Chain Lube Spray (12oz)", qty: 4, unitCost: 22 },
      { description: "O-Ring Assortment Kit", qty: 1, unitCost: 165 },
      { description: "Ground Shipping", qty: 1, unitCost: 55 },
    ],
    attachments: [],
  },
  {
    id: "PO-1037",
    vendor: "Uline",
    vendorEmail: "orders@uline.com",
    shipTo: "123 Service Center Dr, Chicago IL 60601",
    billTo: "Equipify Field Ops, 456 Main St, Chicago IL 60601",
    status: "Draft",
    orderedDate: "",
    eta: "",
    amount: 640,
    workOrderId: "",
    customerId: "",
    customerName: "",
    notes: "Shop consumables restock — gloves, rags, PPE.",
    lineItems: [
      { description: "Nitrile Gloves L (100/box)", qty: 4, unitCost: 28 },
      { description: "Shop Towels (200/roll)", qty: 6, unitCost: 32 },
      { description: "Safety Glasses (12pk)", qty: 2, unitCost: 45 },
      { description: "Ear Plugs (200 pairs)", qty: 2, unitCost: 18 },
      { description: "First Aid Kit Refill", qty: 1, unitCost: 72 },
    ],
    attachments: [],
  },
  {
    id: "PO-1036",
    vendor: "Applied Industrial",
    vendorEmail: "sales@applied.com",
    shipTo: "900 Industrial Pkwy, Detroit MI 48201",
    billTo: "Equipify Field Ops, 456 Main St, Chicago IL 60601",
    status: "Closed",
    orderedDate: "2025-03-28",
    eta: "2025-04-05",
    amount: 4150,
    workOrderId: "WO-1940",
    customerId: "CUS-002",
    customerName: "Apex Fabricators",
    notes: "Complete toolhead rebuild kit for CNC machine.",
    lineItems: [
      { description: "CNC Toolhead Rebuild Kit (Haas VF-2)", qty: 1, unitCost: 3200 },
      { description: "Coolant Pump Seal Kit", qty: 2, unitCost: 145 },
      { description: "Drive Belt Set", qty: 3, unitCost: 88 },
      { description: "Freight", qty: 1, unitCost: 195 },
    ],
    attachments: [],
  },
]

// ─── Reducer ──────────────────────────────────────────────────────────────────

interface POState { orders: PurchaseOrder[] }

type POAction =
  | { type: "ADD_PO"; payload: PurchaseOrder }
  | { type: "UPDATE_PO"; id: string; payload: Partial<PurchaseOrder> }

function poReducer(state: POState, action: POAction): POState {
  switch (action.type) {
    case "ADD_PO":
      return { orders: [action.payload, ...state.orders] }
    case "UPDATE_PO":
      return { orders: state.orders.map((o) => o.id === action.id ? { ...o, ...action.payload } : o) }
    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface POContextValue {
  orders: PurchaseOrder[]
  addOrder: (po: PurchaseOrder) => void
  updateOrder: (id: string, payload: Partial<PurchaseOrder>) => void
}

const POContext = createContext<POContextValue | null>(null)

export function PurchaseOrderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(poReducer, { orders: MOCK_PURCHASE_ORDERS })

  const addOrder = useCallback((po: PurchaseOrder) => dispatch({ type: "ADD_PO", payload: po }), [])
  const updateOrder = useCallback((id: string, payload: Partial<PurchaseOrder>) => dispatch({ type: "UPDATE_PO", id, payload }), [])

  return (
    <POContext.Provider value={{ orders: state.orders, addOrder, updateOrder }}>
      {children}
    </POContext.Provider>
  )
}

export function usePurchaseOrders() {
  const ctx = useContext(POContext)
  if (!ctx) throw new Error("usePurchaseOrders must be inside PurchaseOrderProvider")
  return ctx
}
