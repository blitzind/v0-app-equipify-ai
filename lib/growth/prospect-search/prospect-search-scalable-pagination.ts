/** Scalable pagination + windowing helpers for massive prospect search. Client-safe. */

export const GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER = "growth-scalable-prospect-search-v1" as const

export const PROSPECT_SEARCH_DEFAULT_PAGE_SIZE = 50
export const PROSPECT_SEARCH_MAX_PAGE_SIZE = 500
export const PROSPECT_SEARCH_SCALABLE_PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500] as const
export const PROSPECT_SEARCH_VIRTUALIZATION_WINDOW = 40
export const PROSPECT_SEARCH_VIRTUALIZATION_OVERSCAN = 8

export type ProspectSearchCursorPage = {
  qa_marker: typeof GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER
  page: number
  page_size: number
  total_count: number
  has_next_page: boolean
  cursor: string | null
  next_cursor: string | null
}

export function clampProspectSearchPageSize(pageSize: number | undefined | null): number {
  const raw = pageSize ?? PROSPECT_SEARCH_DEFAULT_PAGE_SIZE
  if (!Number.isFinite(raw)) return PROSPECT_SEARCH_DEFAULT_PAGE_SIZE
  return Math.min(PROSPECT_SEARCH_MAX_PAGE_SIZE, Math.max(1, Math.floor(raw)))
}

export function buildProspectSearchCursor(input: {
  page: number
  page_size: number
  sort_token?: string
}): string {
  return Buffer.from(
    JSON.stringify({
      p: input.page,
      s: input.page_size,
      t: input.sort_token ?? "rank",
    }),
  ).toString("base64url")
}

export function parseProspectSearchCursor(cursor: string | null | undefined): {
  page: number
  page_size: number
  sort_token: string
} | null {
  if (!cursor?.trim()) return null
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      p?: number
      s?: number
      t?: string
    }
    if (!parsed || typeof parsed.p !== "number") return null
    return {
      page: Math.max(1, parsed.p),
      page_size: clampProspectSearchPageSize(parsed.s),
      sort_token: parsed.t ?? "rank",
    }
  } catch {
    return null
  }
}

export function buildProspectSearchCursorPage(input: {
  page: number
  page_size: number
  total_count: number
  sort_token?: string
}): ProspectSearchCursorPage {
  const page_size = clampProspectSearchPageSize(input.page_size)
  const page = Math.max(1, input.page)
  const offset = (page - 1) * page_size
  const has_next_page = offset + page_size < input.total_count
  const cursor = buildProspectSearchCursor({
    page,
    page_size,
    sort_token: input.sort_token,
  })
  const next_cursor = has_next_page
    ? buildProspectSearchCursor({
        page: page + 1,
        page_size,
        sort_token: input.sort_token,
      })
    : null

  return {
    qa_marker: GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER,
    page,
    page_size,
    total_count: input.total_count,
    has_next_page,
    cursor,
    next_cursor,
  }
}

export function sliceProspectSearchVirtualWindow<T>(
  rows: T[],
  scrollTop: number,
  rowHeight: number,
  viewportHeight: number,
): { start: number; end: number; offsetY: number; visible: T[] } {
  const total = rows.length
  if (total === 0) {
    return { start: 0, end: 0, offsetY: 0, visible: [] }
  }

  const start = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - PROSPECT_SEARCH_VIRTUALIZATION_OVERSCAN,
  )
  const visibleCount =
    Math.ceil(viewportHeight / rowHeight) + PROSPECT_SEARCH_VIRTUALIZATION_OVERSCAN * 2
  const end = Math.min(total, start + visibleCount)
  return {
    start,
    end,
    offsetY: start * rowHeight,
    visible: rows.slice(start, end),
  }
}
