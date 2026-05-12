/**
 * Client-safe: derive prepared-workspace `context` hints from the current dashboard URL.
 * Passed to `POST .../aiden/prepared-actions/prepare` and mapped to intent `sourceContext`.
 */

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"

export function buildWorkspacePrepareContext(args: {
  pathname: string | null
  /**
   * List pages may use `?open=<uuid>` for an open drawer (invoice vs quote is inferred from the path).
   */
  drawerOpenId: string | null
  currentModuleLabel: string
}): Record<string, unknown> {
  const path = (args.pathname ?? "").trim() || "/"
  const ctx: Record<string, unknown> = {
    currentPath: path,
    currentModule: args.currentModuleLabel,
  }

  const wo = path.match(new RegExp(`/work-orders/(${UUID})(?:/|$)`, "i"))
  if (wo?.[1]) ctx.workOrderId = wo[1]

  const cust = path.match(new RegExp(`/customers/(${UUID})(?:/|$)`, "i"))
  if (cust?.[1]) ctx.customerId = cust[1]

  const eq = path.match(new RegExp(`/equipment/(${UUID})(?:/|$)`, "i"))
  if (eq?.[1]) ctx.equipmentId = eq[1]

  const open = args.drawerOpenId?.trim()
  if (open && new RegExp(`^${UUID}$`, "i").test(open)) {
    if (/\/quotes(?:\/|$)/i.test(path)) ctx.quoteId = open
    else if (/\/invoices(?:\/|$)/i.test(path)) ctx.invoiceId = open
    else if (/\/maintenance-plans(?:\/|$)/i.test(path)) ctx.maintenancePlanId = open
  }

  return ctx
}
