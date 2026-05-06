"use client"

import { useEffect, useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"

/** Loads primary contact phone for customer-scoped technician quick actions (call/SMS). */
export function useCustomerPrimaryPhone(
  customerId: string | null | undefined,
  organizationId: string | null | undefined,
): string | null {
  const [phone, setPhone] = useState<string | null>(null)

  useEffect(() => {
    if (!customerId?.trim() || !organizationId?.trim()) {
      setPhone(null)
      return
    }
    let cancelled = false
    const supabase = createBrowserSupabaseClient()
    void (async () => {
      const { data, error } = await supabase
        .from("customer_contacts")
        .select("phone")
        .eq("customer_id", customerId)
        .eq("is_primary", true)
        .maybeSingle()
      if (cancelled || error) return
      const raw = (data as { phone?: string | null } | null)?.phone
      const trimmed = typeof raw === "string" ? raw.trim() : ""
      setPhone(trimmed.length > 0 ? trimmed : null)
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, organizationId])

  return phone
}
