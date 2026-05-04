"use client"

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { AdminInvoice, AdminQuote } from "@/lib/mock-data"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { useActiveOrganization } from "@/lib/active-organization-context"
import {
  archiveOrgInvoice,
  archiveOrgQuote,
  fetchInvoicesForOrganization,
  fetchQuotesForOrganization,
  insertOrgInvoice,
  insertOrgQuote,
  updateOrgInvoice,
  updateOrgQuote,
} from "@/lib/org-quotes-invoices/repository"
import type { QuoteStatus, InvoiceStatus } from "@/lib/mock-data"
import type { LineItemJson } from "@/lib/org-quotes-invoices/map"

interface QuoteInvoiceContextValue {
  quotes: AdminQuote[]
  invoices: AdminInvoice[]
  loading: boolean
  error: string | null
  refreshQuotes: () => Promise<void>
  refreshInvoices: () => Promise<void>
  refreshAll: () => Promise<void>
  /** Persists to org_quotes and refreshes list */
  addQuoteFromPayload: (payload: {
    customerId: string
    equipmentId: string | null
    workOrderId: string | null
    title: string
    amountCents: number
    status: QuoteStatus
    expiresAt: string
    lineItems: LineItemJson[]
    notes: string | null
    internalNotes: string | null
    sentAt: string | null
  }) => Promise<{ id?: string; error?: string }>
  updateQuote: (id: string, patch: Parameters<typeof updateOrgQuote>[3]) => Promise<{ error?: string }>
  archiveQuote: (id: string) => Promise<{ error?: string }>
  addInvoiceFromPayload: (payload: {
    customerId: string
    equipmentId: string | null
    workOrderId: string | null
    quoteId: string | null
    title: string
    amountCents: number
    status: InvoiceStatus
    issuedAt: string
    dueDate: string
    paidAt: string | null
    lineItems: LineItemJson[]
    notes: string | null
    internalNotes: string | null
  }) => Promise<{ id?: string; error?: string }>
  updateInvoice: (id: string, patch: Parameters<typeof updateOrgInvoice>[3]) => Promise<{ error?: string }>
  archiveInvoice: (id: string) => Promise<{ error?: string }>
}

const QuoteInvoiceContext = createContext<QuoteInvoiceContextValue | null>(null)

export function QuoteInvoiceProvider({ children }: { children: ReactNode }) {
  const activeOrg = useActiveOrganization()
  const [quotes, setQuotes] = useState<AdminQuote[]>([])
  const [invoices, setInvoices] = useState<AdminInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshQuotes = useCallback(async () => {
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setQuotes([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    const { quotes: q, error: err } = await fetchQuotesForOrganization(supabase, activeOrg.organizationId)
    setQuotes(q)
    if (err) setError(err)
  }, [activeOrg.status, activeOrg.organizationId])

  const refreshInvoices = useCallback(async () => {
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setInvoices([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    const { invoices: inv, error: err } = await fetchInvoicesForOrganization(supabase, activeOrg.organizationId)
    setInvoices(inv)
    if (err) setError(err)
  }, [activeOrg.status, activeOrg.organizationId])

  const refreshAll = useCallback(async () => {
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setQuotes([])
      setInvoices([])
      setLoading(false)
      setError(
        activeOrg.organizations.length === 0
          ? "No organizations found."
          : "Select an organization.",
      )
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createBrowserSupabaseClient()
    const orgId = activeOrg.organizationId
    const [qRes, iRes] = await Promise.all([
      fetchQuotesForOrganization(supabase, orgId),
      fetchInvoicesForOrganization(supabase, orgId),
    ])
    setQuotes(qRes.quotes)
    setInvoices(iRes.invoices)
    const errMsg = qRes.error ?? iRes.error ?? null
    setError(errMsg)
    setLoading(false)
  }, [activeOrg.status, activeOrg.organizationId, activeOrg.organizations.length])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  const addQuoteFromPayload = useCallback(
    async (payload: Parameters<QuoteInvoiceContextValue["addQuoteFromPayload"]>[0]) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await insertOrgQuote(supabase, {
        organizationId: activeOrg.organizationId,
        ...payload,
      })
      if (!res.error) await refreshQuotes()
      return res
    },
    [activeOrg.organizationId, refreshQuotes],
  )

  const updateQuoteCb = useCallback(
    async (id: string, patch: Parameters<QuoteInvoiceContextValue["updateQuote"]>[1]) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await updateOrgQuote(supabase, activeOrg.organizationId, id, patch)
      if (!res.error) await refreshQuotes()
      return res
    },
    [activeOrg.organizationId, refreshQuotes],
  )

  const archiveQuoteCb = useCallback(
    async (id: string) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await archiveOrgQuote(supabase, activeOrg.organizationId, id)
      if (!res.error) await refreshQuotes()
      return res
    },
    [activeOrg.organizationId, refreshQuotes],
  )

  const addInvoiceFromPayload = useCallback(
    async (payload: Parameters<QuoteInvoiceContextValue["addInvoiceFromPayload"]>[0]) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await insertOrgInvoice(supabase, {
        organizationId: activeOrg.organizationId,
        ...payload,
      })
      if (!res.error) await refreshInvoices()
      return res
    },
    [activeOrg.organizationId, refreshInvoices],
  )

  const updateInvoiceCb = useCallback(
    async (id: string, patch: Parameters<QuoteInvoiceContextValue["updateInvoice"]>[1]) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await updateOrgInvoice(supabase, activeOrg.organizationId, id, patch)
      if (!res.error) await refreshInvoices()
      return res
    },
    [activeOrg.organizationId, refreshInvoices],
  )

  const archiveInvoiceCb = useCallback(
    async (id: string) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await archiveOrgInvoice(supabase, activeOrg.organizationId, id)
      if (!res.error) await refreshInvoices()
      return res
    },
    [activeOrg.organizationId, refreshInvoices],
  )

  const value: QuoteInvoiceContextValue = {
    quotes,
    invoices,
    loading,
    error,
    refreshQuotes,
    refreshInvoices,
    refreshAll,
    addQuoteFromPayload,
    updateQuote: updateQuoteCb,
    archiveQuote: archiveQuoteCb,
    addInvoiceFromPayload,
    updateInvoice: updateInvoiceCb,
    archiveInvoice: archiveInvoiceCb,
  }

  return <QuoteInvoiceContext.Provider value={value}>{children}</QuoteInvoiceContext.Provider>
}

export function useQuotes() {
  const ctx = useContext(QuoteInvoiceContext)
  if (!ctx) throw new Error("useQuotes must be used inside QuoteInvoiceProvider")
  return {
    quotes: ctx.quotes,
    loading: ctx.loading,
    error: ctx.error,
    refreshQuotes: ctx.refreshQuotes,
    addQuoteFromPayload: ctx.addQuoteFromPayload,
    updateQuote: ctx.updateQuote,
    archiveQuote: ctx.archiveQuote,
  }
}

export function useInvoices() {
  const ctx = useContext(QuoteInvoiceContext)
  if (!ctx) throw new Error("useInvoices must be used inside QuoteInvoiceProvider")
  return {
    invoices: ctx.invoices,
    loading: ctx.loading,
    error: ctx.error,
    refreshInvoices: ctx.refreshInvoices,
    addInvoiceFromPayload: ctx.addInvoiceFromPayload,
    updateInvoice: ctx.updateInvoice,
    archiveInvoice: ctx.archiveInvoice,
  }
}
