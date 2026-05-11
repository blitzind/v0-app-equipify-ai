/**
 * Canonical KPI / analytics definitions — Phase 63.3.
 * Single source of truth for status sets and windows shared by dashboard, reports,
 * exports, and customer rollups. Behavior is documented in
 * `docs/KPI_AND_ANALYTICS_STANDARDIZATION.md`.
 *
 * Timezone: ISO calendar dates (`YYYY-MM-DD`) use the browser/server **local**
 * calendar for dashboard month bounds (`boundsThisMonth`); report APIs use query
 * param ranges in UTC date form — see doc.
 */

/** Work orders in active dispatch queue (not billing-complete). */
export const WORK_ORDER_OPEN_PIPELINE_DB = ["open", "scheduled", "in_progress"] as const

/**
 * Work orders eligible for **dashboard monthly revenue** sum (labor + parts),
 * filtered by `updated_at` falling in the current calendar month.
 */
export const WORK_ORDER_REVENUE_MONTH_ROLLUP_DB = ["completed", "invoiced"] as const

/**
 * Work orders counted in **Completed this month** (head count): `completed_at`
 * must fall in the current calendar month.
 */
export const WORK_ORDER_COMPLETED_AT_MONTH_DB = [
  "completed",
  "completed_pending_signature",
  "invoiced",
] as const

/**
 * Full pipeline order for dashboard pie / status breakdown (matches staff WO UI ordering).
 */
export const WORK_ORDER_PIPELINE_CHART_ORDER_DB = [
  "open",
  "scheduled",
  "in_progress",
  "completed",
  "completed_pending_signature",
  "invoiced",
] as const

/**
 * Quotes still in sales pipeline (customer rollup + executive dashboard quote card).
 */
export const QUOTE_PIPELINE_DB_STATUSES = ["draft", "sent", "pending_approval"] as const

/** Repeat repair detection: minimum WO rows per equipment in lookback window. */
export const REPEAT_REPAIR_LOOKBACK_DAYS = 90

/** Equipment warranty expiry dashboard card — days ahead from today. */
export const WARRANTY_EXPIRY_LOOKAHEAD_DAYS = 30

/**
 * Reports analytics (`computeReportAnalytics`): revenue rows (by `updated_at` in period).
 */
export const WORK_ORDER_ANALYTICS_REVENUE_PERIOD_DB = ["completed", "invoiced"] as const

/**
 * Reports analytics: cycle-time query + “completed” classification for equipment-type rolls;
 * statuses included use `updated_at` in range where applicable.
 */
export const WORK_ORDER_ANALYTICS_EXTENDED_COMPLETION_DB = [
  "completed",
  "invoiced",
  "completed_pending_signature",
] as const

/** Invoices fetched before applying overdue date logic (AR aging pipeline). */
export const INVOICE_AGING_QUERY_DB = ["sent", "unpaid", "overdue"] as const

/** PM-linked WO rows in analytics revenue window. */
export const WORK_ORDER_ANALYTICS_PM_LINKED_DB = ["completed", "invoiced"] as const
