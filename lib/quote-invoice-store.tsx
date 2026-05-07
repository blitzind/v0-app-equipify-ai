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
import { enforceCanCreateRecord } from "@/app/actions/org-create-enforcement"
import {
  archiveOrgInvoice,
  archiveOrgQuote,
  fetchInvoicesForOrganization,
  fetchQuotesForOrganization,
  insertOrgInvoice,
  insertOrgQuote,
  restoreOrgInvoice,
  restoreOrgQuote,
  updateOrgInvoice,
  updateOrgQuote,
  type RecordArchiveVisibility,
} from "@/lib/org-quotes-invoices/repository"
import type { QuoteStatus, InvoiceStatus } from "@/lib/mock-data"
import type { LineItemJson } from "@/lib/org-quotes-invoices/map"

export type { RecordArchiveVisibility }

interface QuoteInvoiceContextValue {
  quotes: AdminQuote[]
  invoices: AdminInvoice[]
  loading: boolean
  error: string | null
  quotesListVisibility: RecordArchiveVisibility
  setQuotesListVisibility: (v: RecordArchiveVisibility) => void
  invoicesListVisibility: RecordArchiveVisibility
  setInvoicesListVisibility: (v: RecordArchiveVisibility) => void
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
  archiveQuote: (id: string, options?: { archiveReason?: string | null }) => Promise<{ error?: string }>
  restoreQuote: (id: string) => Promise<{ error?: string }>
  addInvoiceFromPayload: (payload: {
    customerId: string
    equipmentId: string | null
    workOrderId: string | null
    quoteId: string | null
    calibrationRecordId: string | null
    title: string
    amountCents: number
    status: InvoiceStatus
    issuedAt: string
    dueDate: string
    paidAt: string | null
    lineItems: LineItemJson[]
    notes: string | null
    internalNotes: string | null
    /** org_invoices.terms_code — Net 30 default applied server-side if omitted */
    termsCode?: string | null
    termsCustomDays?: number | null
  }) => Promise<{ id?: string; error?: string }>
  updateInvoice: (id: string, patch: Parameters<typeof updateOrgInvoice>[3]) => Promise<{ error?: string }>
  archiveInvoice: (id: string, options?: { archiveReason?: string | null }) => Promise<{ error?: string }>
  restoreInvoice: (id: string) => Promise<{ error?: string }>
}

const QuoteInvoiceContext = createContext<QuoteInvoiceContextValue | null>(null)

export function QuoteInvoiceProvider({ children }: { children: ReactNode }) {
  const activeOrg = useActiveOrganization()
  const [quotes, setQuotes] = useState<AdminQuote[]>([])
  const [invoices, setInvoices] = useState<AdminInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quotesListVisibility, setQuotesListVisibility] = useState<RecordArchiveVisibility>("active")
  const [invoicesListVisibility, setInvoicesListVisibility] = useState<RecordArchiveVisibility>("active")

  useEffect(() => {
    setQuotesListVisibility("active")
    setInvoicesListVisibility("active")
  }, [activeOrg.organizationId])

  const reloadLists = useCallback(async () => {
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setQuotes([])
      setInvoices([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    const orgId = activeOrg.organizationId
    const [qRes, iRes] = await Promise.all([
      fetchQuotesForOrganization(supabase, orgId, { visibility: quotesListVisibility }),
      fetchInvoicesForOrganization(supabase, orgId, { visibility: invoicesListVisibility }),
    ])
    setQuotes(qRes.quotes)
    setInvoices(iRes.invoices)
    const errMsg = qRes.error ?? iRes.error ?? null
    if (errMsg) setError(errMsg)
  }, [
    activeOrg.status,
    activeOrg.organizationId,
    quotesListVisibility,
    invoicesListVisibility,
  ])

  useEffect(() => {
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
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      await reloadLists()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [activeOrg.status, activeOrg.organizationId, activeOrg.organizations.length, reloadLists])

  const refreshQuotes = useCallback(async () => {
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setQuotes([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    const { quotes: q, error: err } = await fetchQuotesForOrganization(supabase, activeOrg.organizationId, {
      visibility: quotesListVisibility,
    })
    setQuotes(q)
    if (err) setError(err)
  }, [activeOrg.status, activeOrg.organizationId, quotesListVisibility])

  const refreshInvoices = useCallback(async () => {
    if (activeOrg.status !== "ready" || !activeOrg.organizationId) {
      setInvoices([])
      return
    }
    const supabase = createBrowserSupabaseClient()
    const { invoices: inv, error: err } = await fetchInvoicesForOrganization(
      supabase,
      activeOrg.organizationId,
      { visibility: invoicesListVisibility },
    )
    setInvoices(inv)
    if (err) setError(err)
  }, [activeOrg.status, activeOrg.organizationId, invoicesListVisibility])

  const refreshAll = useCallback(async () => {
    await reloadLists()
  }, [reloadLists])

  const addQuoteFromPayload = useCallback(
    async (payload: Parameters<QuoteInvoiceContextValue["addQuoteFromPayload"]>[0]) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const gate = await enforceCanCreateRecord(activeOrg.organizationId, "quote")
      if (!gate.ok) return { error: gate.message }
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
    async (id: string, options?: { archiveReason?: string | null }) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await archiveOrgQuote(supabase, activeOrg.organizationId, id, options)
      if (!res.error) await refreshQuotes()
      return res
    },
    [activeOrg.organizationId, refreshQuotes],
  )

  const restoreQuoteCb = useCallback(
    async (id: string) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await restoreOrgQuote(supabase, activeOrg.organizationId, id)
      if (!res.error) await refreshQuotes()
      return res
    },
    [activeOrg.organizationId, refreshQuotes],
  )

  const addInvoiceFromPayload = useCallback(
    async (payload: Parameters<QuoteInvoiceContextValue["addInvoiceFromPayload"]>[0]) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const gate = await enforceCanCreateRecord(activeOrg.organizationId, "invoice")
      if (!gate.ok) return { error: gate.message }
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
    async (id: string, options?: { archiveReason?: string | null }) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await archiveOrgInvoice(supabase, activeOrg.organizationId, id, options)
      if (!res.error) await refreshInvoices()
      return res
    },
    [activeOrg.organizationId, refreshInvoices],
  )

  const restoreInvoiceCb = useCallback(
    async (id: string) => {
      if (!activeOrg.organizationId) return { error: "No organization selected." }
      const supabase = createBrowserSupabaseClient()
      const res = await restoreOrgInvoice(supabase, activeOrg.organizationId, id)
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
    quotesListVisibility,
    setQuotesListVisibility,
    invoicesListVisibility,
    setInvoicesListVisibility,
    refreshQuotes,
    refreshInvoices,
    refreshAll,
    addQuoteFromPayload,
    updateQuote: updateQuoteCb,
    archiveQuote: archiveQuoteCb,
    restoreQuote: restoreQuoteCb,
    addInvoiceFromPayload,
    updateInvoice: updateInvoiceCb,
    archiveInvoice: archiveInvoiceCb,
    restoreInvoice: restoreInvoiceCb,
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
    quotesListVisibility: ctx.quotesListVisibility,
    setQuotesListVisibility: ctx.setQuotesListVisibility,
    refreshQuotes: ctx.refreshQuotes,
    addQuoteFromPayload: ctx.addQuoteFromPayload,
    updateQuote: ctx.updateQuote,
    archiveQuote: ctx.archiveQuote,
    restoreQuote: ctx.restoreQuote,
  }
}

export function useInvoices() {
  const ctx = useContext(QuoteInvoiceContext)
  if (!ctx) throw new Error("useInvoices must be used inside QuoteInvoiceProvider")
  return {
    invoices: ctx.invoices,
    loading: ctx.loading,
    error: ctx.error,
    invoicesListVisibility: ctx.invoicesListVisibility,
    setInvoicesListVisibility: ctx.setInvoicesListVisibility,
    refreshInvoices: ctx.refreshInvoices,
    addInvoiceFromPayload: ctx.addInvoiceFromPayload,
    updateInvoice: ctx.updateInvoice,
    archiveInvoice: ctx.archiveInvoice,
    restoreInvoice: ctx.restoreInvoice,
  }
}
