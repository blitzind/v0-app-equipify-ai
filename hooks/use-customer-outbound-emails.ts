"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { isValidEmail } from "@/lib/email/format"

/**
 * Billing + active contact emails for a customer (for outbound recipient pickers).
 */
export function useCustomerOutboundEmails(organizationId: string | null, customerId: string | null) {
  const [emails, setEmails] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId || !customerId) {
      setEmails([])
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const sb = createBrowserSupabaseClient()
    void (async () => {
      try {
        const [{ data: cust, error: cErr }, { data: rows, error: rErr }] = await Promise.all([
          sb
            .from("customers")
            .select("billing_email")
            .eq("id", customerId)
            .eq("organization_id", organizationId)
            .maybeSingle(),
          sb
            .from("customer_contacts")
            .select("email")
            .eq("customer_id", customerId)
            .eq("organization_id", organizationId)
            .is("archived_at", null),
        ])
        if (cancelled) return
        if (cErr || rErr) {
          setError(cErr?.message ?? rErr?.message ?? "Failed to load customer emails")
          setEmails([])
          return
        }
        const uniq = new Set<string>()
        const be = String((cust as { billing_email?: string | null } | null)?.billing_email ?? "")
          .trim()
          .toLowerCase()
        if (isValidEmail(be)) uniq.add(be)
        for (const r of rows ?? []) {
          const e = String((r as { email?: string | null }).email ?? "")
            .trim()
            .toLowerCase()
          if (isValidEmail(e)) uniq.add(e)
        }
        setEmails([...uniq].sort((a, b) => a.localeCompare(b)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, customerId])

  return { emails, loading, error }
}
