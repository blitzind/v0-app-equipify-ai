"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react"
import type { CalibrationCertificate } from "@/lib/mock-data"

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  certificates: CalibrationCertificate[]
}

type Action =
  | { type: "ADD"; payload: CalibrationCertificate }
  | { type: "DELETE"; id: string }
  | { type: "ATTACH_TO_INVOICE"; certId: string; invoiceId: string }
  | { type: "DETACH_FROM_INVOICE"; certId: string; invoiceId: string }
  | { type: "UPDATE_NOTES"; id: string; notes: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD":
      return { ...state, certificates: [action.payload, ...state.certificates] }

    case "DELETE":
      return { ...state, certificates: state.certificates.filter((c) => c.id !== action.id) }

    case "ATTACH_TO_INVOICE":
      return {
        ...state,
        certificates: state.certificates.map((c) =>
          c.id === action.certId && !c.attachedToInvoices.includes(action.invoiceId)
            ? { ...c, attachedToInvoices: [...c.attachedToInvoices, action.invoiceId] }
            : c
        ),
      }

    case "DETACH_FROM_INVOICE":
      return {
        ...state,
        certificates: state.certificates.map((c) =>
          c.id === action.certId
            ? { ...c, attachedToInvoices: c.attachedToInvoices.filter((id) => id !== action.invoiceId) }
            : c
        ),
      }

    case "UPDATE_NOTES":
      return {
        ...state,
        certificates: state.certificates.map((c) =>
          c.id === action.id ? { ...c, notes: action.notes } : c
        ),
      }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CertificateContextValue {
  certificates: CalibrationCertificate[]
  addCertificate: (cert: CalibrationCertificate) => void
  deleteCertificate: (id: string) => void
  attachToInvoice: (certId: string, invoiceId: string) => void
  detachFromInvoice: (certId: string, invoiceId: string) => void
  updateNotes: (id: string, notes: string) => void
  getCertsByEquipment: (equipmentId: string) => CalibrationCertificate[]
  getCertsByInvoice: (invoiceId: string) => CalibrationCertificate[]
  getCertsByCustomer: (customerId: string) => CalibrationCertificate[]
}

const CertificateContext = createContext<CertificateContextValue | null>(null)

export function CertificateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { certificates: [] })

  const addCertificate    = useCallback((cert: CalibrationCertificate) => dispatch({ type: "ADD", payload: cert }), [])
  const deleteCertificate = useCallback((id: string) => dispatch({ type: "DELETE", id }), [])
  const attachToInvoice   = useCallback((certId: string, invoiceId: string) => dispatch({ type: "ATTACH_TO_INVOICE", certId, invoiceId }), [])
  const detachFromInvoice = useCallback((certId: string, invoiceId: string) => dispatch({ type: "DETACH_FROM_INVOICE", certId, invoiceId }), [])
  const updateNotes       = useCallback((id: string, notes: string) => dispatch({ type: "UPDATE_NOTES", id, notes }), [])

  const getCertsByEquipment = useCallback(
    (equipmentId: string) => state.certificates.filter((c) => c.equipmentId === equipmentId),
    [state.certificates]
  )
  const getCertsByInvoice = useCallback(
    (invoiceId: string) => state.certificates.filter((c) => c.attachedToInvoices.includes(invoiceId)),
    [state.certificates]
  )
  const getCertsByCustomer = useCallback(
    (customerId: string) => state.certificates.filter((c) => c.customerId === customerId),
    [state.certificates]
  )

  return (
    <CertificateContext.Provider value={{
      certificates: state.certificates,
      addCertificate,
      deleteCertificate,
      attachToInvoice,
      detachFromInvoice,
      updateNotes,
      getCertsByEquipment,
      getCertsByInvoice,
      getCertsByCustomer,
    }}>
      {children}
    </CertificateContext.Provider>
  )
}

export function useCertificates() {
  const ctx = useContext(CertificateContext)
  if (!ctx) throw new Error("useCertificates must be used inside CertificateProvider")
  return ctx
}
