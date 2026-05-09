import type { SupabaseClient } from "@supabase/supabase-js"

export type DedupeMatch = {
  customer_id: string
  company_name: string
  match_reason: "contact_email" | "company_name"
}

/**
 * Find existing customers by primary contact email (case-insensitive) or company name.
 */
export async function findCustomersByRequesterIdentity(
  supabase: SupabaseClient,
  organizationId: string,
  email: string | null | undefined,
  companyName: string | null | undefined,
): Promise<DedupeMatch[]> {
  const out: DedupeMatch[] = []
  const seen = new Set<string>()

  const em = typeof email === "string" ? email.trim().toLowerCase() : ""
  if (em.length > 3 && em.includes("@")) {
    const { data: contacts } = await supabase
      .from("customer_contacts")
      .select("customer_id")
      .eq("organization_id", organizationId)
      .ilike("email", em)
      .limit(25)

    const contactCustomerIds = [...new Set((contacts ?? []).map((r) => (r as { customer_id: string }).customer_id))]
    if (contactCustomerIds.length > 0) {
      const { data: custRows } = await supabase
        .from("customers")
        .select("id, company_name")
        .eq("organization_id", organizationId)
        .in("id", contactCustomerIds)
        .is("archived_at", null)

      for (const c of custRows ?? []) {
        const cid = (c as { id: string }).id
        if (!cid || seen.has(cid)) continue
        seen.add(cid)
        out.push({
          customer_id: cid,
          company_name: (c as { company_name: string }).company_name,
          match_reason: "contact_email",
        })
      }
    }
  }

  const co = typeof companyName === "string" ? companyName.trim() : ""
  if (co.length > 1) {
    const { data: custs } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .ilike("company_name", co)
      .is("archived_at", null)
      .limit(25)

    for (const c of custs ?? []) {
      const cid = (c as { id: string }).id
      if (!cid || seen.has(cid)) continue
      seen.add(cid)
      out.push({
        customer_id: cid,
        company_name: (c as { company_name: string }).company_name,
        match_reason: "company_name",
      })
    }
  }

  return out
}
