"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { adminQuotes as initialQuotes, adminInvoices as initialInvoices } from "@/lib/mock-data"
import type { AdminQuote, AdminInvoice } from "@/lib/mock-data"
import { useWorkspaceData } from "@/lib/tenant-store"

// ─── Quotes ───────────────────────────────────────────────────────────────────

interface QuoteState { quotes: AdminQuote[] }
type QuoteAction =
  | { type: "ADD_QUOTE"; payload: AdminQuote }
  | { type: "UPDATE_QUOTE"; id: string; payload: Partial<AdminQuote> }
  | { type: "RESET_QUOTES"; quotes: AdminQuote[] }

function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  switch (action.type) {
    case "ADD_QUOTE":
      return { quotes: [action.payload, ...state.quotes] }
    case "UPDATE_QUOTE":
      return { quotes: state.quotes.map((q) => q.id === action.id ? { ...q, ...action.payload } : q) }
    case "RESET_QUOTES":
      return { quotes: action.quotes }
    default:
      return state
  }
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

interface InvoiceState { invoices: AdminInvoice[] }
type InvoiceAction =
  | { type: "ADD_INVOICE"; payload: AdminInvoice }
  | { type: "UPDATE_INVOICE"; id: string; payload: Partial<AdminInvoice> }
  | { type: "RESET_INVOICES"; invoices: AdminInvoice[] }

function invoiceReducer(state: InvoiceState, action: InvoiceAction): InvoiceState {
  switch (action.type) {
    case "ADD_INVOICE":
      return { invoices: [action.payload, ...state.invoices] }
    case "UPDATE_INVOICE":
      return { invoices: state.invoices.map((i) => i.id === action.id ? { ...i, ...action.payload } : i) }
    case "RESET_INVOICES":
      return { invoices: action.invoices }
    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface QuoteInvoiceContextValue {
  quotes: AdminQuote[]
  invoices: AdminInvoice[]
  addQuote: (q: AdminQuote) => void
  updateQuote: (id: string, payload: Partial<AdminQuote>) => void
  addInvoice: (i: AdminInvoice) => void
  updateInvoice: (id: string, payload: Partial<AdminInvoice>) => void
}

const QuoteInvoiceContext = createContext<QuoteInvoiceContextValue | null>(null)

export function QuoteInvoiceProvider({ children }: { children: ReactNode }) {
  const { quotes: wsQuotes, invoices: wsInvoices } = useWorkspaceData()
  const [qState, qDispatch] = useReducer(quoteReducer, { quotes: wsQuotes })
  const [iState, iDispatch] = useReducer(invoiceReducer, { invoices: wsInvoices })

  useEffect(() => {
    qDispatch({ type: "RESET_QUOTES", quotes: wsQuotes })
    iDispatch({ type: "RESET_INVOICES", invoices: wsInvoices })
  }, [wsQuotes, wsInvoices])

  const addQuote = useCallback((q: AdminQuote) => qDispatch({ type: "ADD_QUOTE", payload: q }), [])
  const updateQuote = useCallback((id: string, payload: Partial<AdminQuote>) => qDispatch({ type: "UPDATE_QUOTE", id, payload }), [])
  const addInvoice = useCallback((i: AdminInvoice) => iDispatch({ type: "ADD_INVOICE", payload: i }), [])
  const updateInvoice = useCallback((id: string, payload: Partial<AdminInvoice>) => iDispatch({ type: "UPDATE_INVOICE", id, payload }), [])

  return (
    <QuoteInvoiceContext.Provider value={{
      quotes: qState.quotes,
      invoices: iState.invoices,
      addQuote,
      updateQuote,
      addInvoice,
      updateInvoice,
    }}>
      {children}
    </QuoteInvoiceContext.Provider>
  )
}

export function useQuotes() {
  const ctx = useContext(QuoteInvoiceContext)
  if (!ctx) throw new Error("useQuotes must be used inside QuoteInvoiceProvider")
  return { quotes: ctx.quotes, addQuote: ctx.addQuote, updateQuote: ctx.updateQuote }
}

export function useInvoices() {
  const ctx = useContext(QuoteInvoiceContext)
  if (!ctx) throw new Error("useInvoices must be used inside QuoteInvoiceProvider")
  return { invoices: ctx.invoices, addInvoice: ctx.addInvoice, updateInvoice: ctx.updateInvoice }
}
