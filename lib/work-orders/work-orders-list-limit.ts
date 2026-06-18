/**
 * Client-side work order list hydration cap for `/work-orders`.
 * Bounds the default Supabase select; search/filters run on this window only.
 */
export const WORK_ORDERS_LIST_PAGE_LIMIT = 100 as const
