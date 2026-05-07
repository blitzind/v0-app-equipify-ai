import "server-only"

/**
 * Customer Hierarchy — Phase 2 (portal preparation, not yet exposed in UI)
 *
 * When a portal user belongs to a customer that has sub-accounts, future
 * portal phases will let them choose between:
 *   - "Just <My Account>" (current default)
 *   - "<My Account> + sub-accounts" (consolidated view)
 *
 * Phase 2 only ships the **resolution helper** so other server-side portal
 * routes can adopt it incrementally without a UI change. The default policy
 * is unchanged: the helper returns just the portal user's own customer id.
 *
 * To enable consolidated visibility for a portal user, set
 * `portal_users.consolidated_rollup_enabled = true` once the column ships in
 * a later migration. Until then this helper always returns the single id —
 * fully backwards-compatible.
 *
 * Strict rules:
 *   - server-only; uses the existing service-role client
 *   - never expands beyond the rollup tree of the portal user's own root
 *   - same-org filter is applied at every step
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCustomerRollupTree } from "@/lib/customers/consolidated-rollup"

export type PortalCustomerScope = {
  /** Customer ids the portal session is allowed to see. Always >= 1. */
  customerIds: string[]
  /**
   * True when the portal user has explicitly opted into consolidated view
   * across sub-accounts. Phase 2 always returns false.
   */
  consolidated: boolean
}

type PortalUserLite = {
  id: string
  organization_id: string
  customer_id: string
  /**
   * Phase 3+: a future migration may add this column. We probe for it via
   * a separate select; missing column simply means "consolidated = false".
   */
  consolidated_rollup_enabled?: boolean | null
}

/**
 * Resolve the customer ids visible to a portal session.
 *
 * Phase 2 behavior: always returns just the portal user's own customer id.
 * Phase 3+ behavior: when `portal_users.consolidated_rollup_enabled = true`
 * AND the customer is a parent account, expands to the customer + all
 * descendants (capped by `loadCustomerRollupTree`'s MAX_DEPTH).
 */
export async function resolvePortalCustomerScope(
  svc: SupabaseClient,
  args: { portalUser: Pick<PortalUserLite, "organization_id" | "customer_id" | "consolidated_rollup_enabled"> },
): Promise<PortalCustomerScope> {
  const { organization_id, customer_id, consolidated_rollup_enabled } = args.portalUser

  const consolidated = Boolean(consolidated_rollup_enabled)
  if (!consolidated) {
    return { customerIds: [customer_id], consolidated: false }
  }

  const tree = await loadCustomerRollupTree(svc, {
    organizationId: organization_id,
    rootCustomerId: customer_id,
  })
  if (tree.length === 0) {
    return { customerIds: [customer_id], consolidated: false }
  }
  return {
    customerIds: tree.map((t) => t.id),
    consolidated: true,
  }
}
