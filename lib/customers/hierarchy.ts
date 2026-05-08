/**
 * Customer Hierarchy + Billing/Service Address — Phase 1
 *
 * Browser-side helpers for loading parent/child relationships, location and
 * child counts, and resolving the operational "billing address" for a
 * customer. All helpers are non-throwing and degrade safely when the Phase 1
 * migration has not yet been applied on the target DB (e.g. local dev).
 *
 * Strict rules:
 * - Never expose raw UUIDs in returned display strings.
 * - Always filter by `organization_id` (RLS-safe).
 * - Read-only. Mutations belong in dedicated drawer/page handlers.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  missingCustomerHierarchyColumns,
  missingCustomerHierarchyView,
} from "@/lib/customers/postgrest-fallback"

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerLite = {
  id: string
  organizationId: string
  companyName: string
  status: "active" | "inactive"
  isArchived: boolean
}

export type ServiceAddress = {
  locationId: string | null
  /** Human label like "Main Office" if the source row has a name. */
  name: string | null
  line1: string
  line2: string | null
  city: string
  state: string
  postalCode: string
}

export type BillingAddress = {
  billingName: string | null
  /** True when the operational billing address is inherited from the default service location. */
  inheritsFromDefaultLocation: boolean
  /** Optional "Attn:" line. */
  attention: string | null
  contactName: string | null
  /** Billing recipient email (separate from primary contact). */
  email: string | null
  phone: string | null
  line1: string
  line2: string | null
  city: string
  state: string
  postalCode: string
  country: string | null
  notes: string | null
  behavior: "own_billing" | "parent_billing" | "custom" | null
  poRequired: boolean
  poRequiredBeforeService: boolean
  poRequiredBeforeInvoice: boolean
  defaultPoNumber: string | null
  invoiceInstructions: string | null
  invoiceDeliveryPreference: string | null
}

export type CustomerHierarchySummary = {
  customerId: string
  organizationId: string
  /** Parent customer (null when the customer is itself a top-level account). */
  parent: CustomerLite | null
  /** Direct (active, non-archived) child accounts. */
  children: CustomerLite[]
  /** Active service location count. */
  locationCount: number
  /** Number of direct children (precomputed for the customer list). */
  childCount: number
  /** Resolved default service address (from the default `customer_locations` row), if any. */
  defaultServiceAddress: ServiceAddress | null
  /** Operational billing address. */
  billingAddress: BillingAddress
  /**
   * True when the operational billing address has no usable street/city. The
   * UI surfaces a soft warning in this state because invoice-style
   * documents will fall back to the default service location.
   */
  billingAddressMissing: boolean
  /**
   * True when the Phase 1 migration is not yet applied to this DB. Callers
   * may show a softer "hierarchy unavailable" message instead of an error.
   */
  schemaMigrationPending: boolean
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

type CustomerHierarchyRow = {
  id: string
  organization_id: string
  company_name: string
  status: "active" | "inactive"
  archived_at: string | null
  parent_customer_id: string | null
  billing_address_same_as_service: boolean | null
  billing_attention: string | null
  billing_name: string | null
  billing_contact_name: string | null
  billing_email: string | null
  billing_contact_phone: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_postal_code: string | null
  billing_country: string | null
  billing_notes: string | null
  billing_behavior: "own_billing" | "parent_billing" | "custom" | null
  po_required: boolean | null
  po_number_required_before_service: boolean | null
  po_number_required_before_invoice: boolean | null
  default_po_number: string | null
  invoice_delivery_preference: string | null
  invoice_instructions: string | null
}

type LegacyCustomerRow = {
  id: string
  organization_id: string
  company_name: string
  status: "active" | "inactive"
  archived_at: string | null
}

type DefaultLocationRow = {
  id: string
  name: string | null
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
}

const CUSTOMER_HIERARCHY_SELECT =
  "id, organization_id, company_name, status, archived_at, " +
  "parent_customer_id, billing_address_same_as_service, billing_name, billing_attention, billing_contact_name, billing_email, billing_contact_phone, " +
  "billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country, billing_notes, " +
  "billing_behavior, po_required, po_number_required_before_service, po_number_required_before_invoice, default_po_number, invoice_delivery_preference, invoice_instructions"

const CUSTOMER_LITE_SELECT = "id, organization_id, company_name, status, archived_at"

const DEFAULT_LOCATION_SELECT =
  "id, name, address_line1, address_line2, city, state, postal_code"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToLite(row: LegacyCustomerRow): CustomerLite {
  return {
    id: row.id,
    organizationId: row.organization_id,
    companyName: row.company_name,
    status: row.status === "inactive" ? "inactive" : "active",
    isArchived: Boolean(row.archived_at),
  }
}

function locationToService(loc: DefaultLocationRow | null): ServiceAddress | null {
  if (!loc) return null
  return {
    locationId: loc.id,
    name: loc.name?.trim() ? loc.name.trim() : null,
    line1: loc.address_line1 ?? "",
    line2: loc.address_line2?.trim() ? loc.address_line2.trim() : null,
    city: loc.city ?? "",
    state: loc.state ?? "",
    postalCode: loc.postal_code ?? "",
  }
}

/**
 * Pure: derive an operational `BillingAddress` from a customer row + its
 * default service location. When `billing_address_same_as_service` is true (or
 * the migration has not run yet, signalled by `null`), we mirror the default
 * service location so existing invoice flows keep working unchanged.
 */
function deriveBillingAddress(
  row: Partial<CustomerHierarchyRow> | null,
  defaultService: ServiceAddress | null,
): { address: BillingAddress; missing: boolean } {
  const inherits =
    row?.billing_address_same_as_service === null ||
    row?.billing_address_same_as_service === undefined
      ? true
      : Boolean(row.billing_address_same_as_service)

  if (inherits) {
    return {
      address: {
        billingName: row?.billing_name?.trim() || null,
        inheritsFromDefaultLocation: true,
        attention: row?.billing_attention?.trim() || null,
        contactName: row?.billing_contact_name?.trim() || null,
        email: row?.billing_email?.trim() || null,
        phone: row?.billing_contact_phone?.trim() || null,
        line1: defaultService?.line1 ?? "",
        line2: defaultService?.line2 ?? null,
        city: defaultService?.city ?? "",
        state: defaultService?.state ?? "",
        postalCode: defaultService?.postalCode ?? "",
        country: row?.billing_country?.trim() || null,
        notes: row?.billing_notes?.trim() || null,
        behavior: row?.billing_behavior ?? null,
        poRequired: Boolean(row?.po_required),
        poRequiredBeforeService: Boolean(row?.po_number_required_before_service),
        poRequiredBeforeInvoice: Boolean(row?.po_number_required_before_invoice),
        defaultPoNumber: row?.default_po_number?.trim() || null,
        invoiceInstructions: row?.invoice_instructions?.trim() || null,
        invoiceDeliveryPreference: row?.invoice_delivery_preference?.trim() || null,
      },
      missing: !defaultService || !defaultService.line1?.trim() || !defaultService.city?.trim(),
    }
  }

  const line1 = row?.billing_address_line1?.trim() ?? ""
  const city = row?.billing_city?.trim() ?? ""
  return {
    address: {
      billingName: row?.billing_name?.trim() || null,
      inheritsFromDefaultLocation: false,
      attention: row?.billing_attention?.trim() || null,
      contactName: row?.billing_contact_name?.trim() || null,
      email: row?.billing_email?.trim() || null,
      phone: row?.billing_contact_phone?.trim() || null,
      line1,
      line2: row?.billing_address_line2?.trim() || null,
      city,
      state: row?.billing_state?.trim() ?? "",
      postalCode: row?.billing_postal_code?.trim() ?? "",
      country: row?.billing_country?.trim() || null,
      notes: row?.billing_notes?.trim() || null,
      behavior: row?.billing_behavior ?? null,
      poRequired: Boolean(row?.po_required),
      poRequiredBeforeService: Boolean(row?.po_number_required_before_service),
      poRequiredBeforeInvoice: Boolean(row?.po_number_required_before_invoice),
      defaultPoNumber: row?.default_po_number?.trim() || null,
      invoiceInstructions: row?.invoice_instructions?.trim() || null,
      invoiceDeliveryPreference: row?.invoice_delivery_preference?.trim() || null,
    },
    missing: !line1 || !city,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load a single customer's hierarchy summary (parent, children, counts, and
 * resolved billing/service addresses). Always returns a value — when the
 * Phase 1 migration is missing, the result has `schemaMigrationPending = true`
 * and the billing address inherits from the default service location.
 */
export async function loadCustomerHierarchy(
  supabase: SupabaseClient,
  args: { organizationId: string; customerId: string },
): Promise<CustomerHierarchySummary | null> {
  const { organizationId, customerId } = args

  // 1. Customer row (with hierarchy/billing fields when present).
  let row: CustomerHierarchyRow | null = null
  let schemaMigrationPending = false

  const fullRes = await supabase
    .from("customers")
    .select(CUSTOMER_HIERARCHY_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle()

  if (fullRes.error && missingCustomerHierarchyColumns(fullRes.error)) {
    schemaMigrationPending = true
    const legacyRes = await supabase
      .from("customers")
      .select(CUSTOMER_LITE_SELECT)
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .maybeSingle()
    if (legacyRes.error || !legacyRes.data) return null
    const legacy = legacyRes.data as LegacyCustomerRow
    row = {
      id: legacy.id,
      organization_id: legacy.organization_id,
      company_name: legacy.company_name,
      status: legacy.status,
      archived_at: legacy.archived_at,
      parent_customer_id: null,
      billing_address_same_as_service: true,
      billing_name: null,
      billing_attention: null,
      billing_contact_name: null,
      billing_email: null,
      billing_contact_phone: null,
      billing_address_line1: null,
      billing_address_line2: null,
      billing_city: null,
      billing_state: null,
      billing_postal_code: null,
      billing_country: null,
      billing_notes: null,
      billing_behavior: null,
      po_required: null,
      po_number_required_before_service: null,
      po_number_required_before_invoice: null,
      default_po_number: null,
      invoice_delivery_preference: null,
      invoice_instructions: null,
    }
  } else if (fullRes.error || !fullRes.data) {
    return null
  } else {
    row = fullRes.data as CustomerHierarchyRow
  }

  if (!row) return null

  // 2. Default service location (single primary row).
  const defaultLocRes = await supabase
    .from("customer_locations")
    .select(DEFAULT_LOCATION_SELECT)
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("is_default", true)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  let defaultService: ServiceAddress | null = locationToService(
    (defaultLocRes.data as DefaultLocationRow | null) ?? null,
  )

  // Fallback: if no row marked default, take the most recent active location.
  if (!defaultService) {
    const anyLocRes = await supabase
      .from("customer_locations")
      .select(DEFAULT_LOCATION_SELECT)
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    defaultService = locationToService(
      (anyLocRes.data as DefaultLocationRow | null) ?? null,
    )
  }

  // 3. Parent + children + location count (parallel; cheap).
  const [parentRes, childrenRes, locCountRes] = await Promise.all([
    row.parent_customer_id
      ? supabase
          .from("customers")
          .select(CUSTOMER_LITE_SELECT)
          .eq("organization_id", organizationId)
          .eq("id", row.parent_customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    schemaMigrationPending
      ? Promise.resolve({ data: [] as LegacyCustomerRow[], error: null } as const)
      : supabase
          .from("customers")
          .select(CUSTOMER_LITE_SELECT)
          .eq("organization_id", organizationId)
          .eq("parent_customer_id", customerId)
          .is("archived_at", null)
          .order("company_name", { ascending: true })
          .limit(50),
    supabase
      .from("customer_locations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .is("archived_at", null),
  ])

  const parent = parentRes.data ? rowToLite(parentRes.data as LegacyCustomerRow) : null
  const children = ((childrenRes.data ?? []) as LegacyCustomerRow[]).map(rowToLite)
  const locationCount = typeof locCountRes.count === "number" ? locCountRes.count : 0

  const billing = deriveBillingAddress(row, defaultService)

  return {
    customerId,
    organizationId,
    parent,
    children,
    locationCount,
    childCount: children.length,
    defaultServiceAddress: defaultService,
    billingAddress: billing.address,
    billingAddressMissing: billing.missing,
    schemaMigrationPending,
  }
}

// ─── List-view helpers ────────────────────────────────────────────────────────

export type CustomerHierarchySummaryRow = {
  customer_id: string
  parent_customer_id: string | null
  child_count: number
  location_count: number
}

/**
 * Bulk-load child counts and location counts from the read-only
 * `customer_hierarchy_summary` view for a list of customer ids.
 *
 * Falls back to a per-list aggregate when the view is missing (legacy DBs
 * without the Phase 1 migration). Always non-throwing — returns an empty Map
 * on failure so the customer list still renders.
 */
export async function loadHierarchySummariesForList(
  supabase: SupabaseClient,
  args: { organizationId: string; customerIds: string[] },
): Promise<Map<string, CustomerHierarchySummaryRow>> {
  const out = new Map<string, CustomerHierarchySummaryRow>()
  const { organizationId, customerIds } = args
  if (customerIds.length === 0) return out

  const viewRes = await supabase
    .from("customer_hierarchy_summary")
    .select("customer_id, parent_customer_id, child_count, location_count")
    .eq("organization_id", organizationId)
    .in("customer_id", customerIds)

  if (!viewRes.error && viewRes.data) {
    for (const row of viewRes.data as CustomerHierarchySummaryRow[]) {
      out.set(row.customer_id, row)
    }
    return out
  }

  if (!missingCustomerHierarchyView(viewRes.error)) {
    return out
  }

  // Legacy fallback: only location counts (parent_customer_id column absent).
  const locRes = await supabase
    .from("customer_locations")
    .select("customer_id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .in("customer_id", customerIds)

  const locCount = new Map<string, number>()
  for (const r of (locRes.data ?? []) as Array<{ customer_id: string }>) {
    locCount.set(r.customer_id, (locCount.get(r.customer_id) ?? 0) + 1)
  }
  for (const id of customerIds) {
    out.set(id, {
      customer_id: id,
      parent_customer_id: null,
      child_count: 0,
      location_count: locCount.get(id) ?? 0,
    })
  }
  return out
}

// ─── Display helpers (no raw UUIDs) ──────────────────────────────────────────

/** Compact one-line label for a service address. Returns null when the
 *  address has no usable street/city (callers should show a soft empty state). */
export function formatServiceAddressLine(addr: ServiceAddress | null): string | null {
  if (!addr) return null
  const street = [addr.line1, addr.line2].filter((s) => s && s.trim()).join(", ").trim()
  const cityState = [addr.city, addr.state].filter((s) => s && s.trim()).join(", ").trim()
  const tail = [cityState, addr.postalCode?.trim()].filter(Boolean).join(" ").trim()
  const label = [street, tail].filter(Boolean).join(" — ")
  return label || null
}

/** Compact one-line label for a billing address. */
export function formatBillingAddressLine(addr: BillingAddress | null): string | null {
  if (!addr) return null
  const street = [addr.line1, addr.line2].filter((s) => s && s.trim()).join(", ").trim()
  const cityState = [addr.city, addr.state].filter((s) => s && s.trim()).join(", ").trim()
  const tail = [cityState, addr.postalCode?.trim()].filter(Boolean).join(" ").trim()
  const label = [street, tail].filter(Boolean).join(" — ")
  return label || null
}
