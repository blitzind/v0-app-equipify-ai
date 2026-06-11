/** Apollo pipeline queue pagination, search, and sort — client-safe. */

export const APOLLO_QUEUE_PAGINATION_QA_MARKER = "apollo-queue-pagination-v1" as const

export const APOLLO_QUEUE_DEFAULT_PAGE_SIZE = 25 as const
export const APOLLO_QUEUE_MAX_PAGE_SIZE = 100 as const
/** Max rows scanned from DB before in-memory search/sort/paginate. */
export const APOLLO_QUEUE_MAX_SCAN = 500 as const

export const APOLLO_QUEUE_SORT_KEYS = [
  "created_at_desc",
  "created_at_asc",
  "company_name_asc",
  "qualification_score_desc",
] as const

export type ApolloQueueSortKey = (typeof APOLLO_QUEUE_SORT_KEYS)[number]

export type ApolloQueuePaginationInput = {
  page?: number
  page_size?: number
  search?: string | null
  sort?: ApolloQueueSortKey | null
}

export type ApolloQueuePaginationMeta = {
  page: number
  page_size: number
  total: number
  total_pages: number
  has_next_page: boolean
  has_previous_page: boolean
  search: string | null
  sort: ApolloQueueSortKey
}

export type ApolloQueuePaginatedResult<T> = {
  items: T[]
  pagination: ApolloQueuePaginationMeta
}

function clampPage(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value))
}

function clampPageSize(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return APOLLO_QUEUE_DEFAULT_PAGE_SIZE
  return Math.min(APOLLO_QUEUE_MAX_PAGE_SIZE, Math.max(1, Math.floor(value)))
}

export function parseApolloQueueSortKey(value: string | null | undefined): ApolloQueueSortKey {
  const normalized = (value ?? "").trim()
  if ((APOLLO_QUEUE_SORT_KEYS as readonly string[]).includes(normalized)) {
    return normalized as ApolloQueueSortKey
  }
  return "created_at_desc"
}

export function parseApolloQueuePaginationInput(input?: ApolloQueuePaginationInput): {
  page: number
  page_size: number
  search: string | null
  sort: ApolloQueueSortKey
} {
  return {
    page: clampPage(input?.page),
    page_size: clampPageSize(input?.page_size),
    search: input?.search?.trim() || null,
    sort: parseApolloQueueSortKey(input?.sort ?? null),
  }
}

export function normalizeApolloQueueSearchTerm(term: string | null | undefined): string {
  return (term ?? "").trim().toLowerCase()
}

export function matchesApolloQueueSearch(
  haystack: Array<string | null | undefined>,
  term: string | null | undefined,
): boolean {
  const normalized = normalizeApolloQueueSearchTerm(term)
  if (!normalized) return true
  return haystack.some((value) => (value ?? "").toLowerCase().includes(normalized))
}

export function compareApolloQueueRows(
  left: {
    company_name?: string | null
    full_name?: string | null
    created_at?: string | null
    qualification_score?: number | null
  },
  right: {
    company_name?: string | null
    full_name?: string | null
    created_at?: string | null
    qualification_score?: number | null
  },
  sort: ApolloQueueSortKey,
): number {
  if (sort === "company_name_asc") {
    return (left.company_name ?? "").localeCompare(right.company_name ?? "", undefined, {
      sensitivity: "base",
    })
  }
  if (sort === "qualification_score_desc") {
    return (right.qualification_score ?? 0) - (left.qualification_score ?? 0)
  }
  const leftTime = Date.parse(left.created_at ?? "")
  const rightTime = Date.parse(right.created_at ?? "")
  if (sort === "created_at_asc") return leftTime - rightTime
  return rightTime - leftTime
}

export function paginateApolloQueueItems<T extends {
  company_name?: string | null
  full_name?: string | null
  created_at?: string | null
  qualification_score?: number | null
}>(
  items: T[],
  input?: ApolloQueuePaginationInput,
  matchSearch?: (item: T, term: string) => boolean,
): ApolloQueuePaginatedResult<T> {
  const parsed = parseApolloQueuePaginationInput(input)
  const term = parsed.search

  let filtered = items
  if (term) {
    filtered = items.filter((item) => {
      if (matchSearch) return matchSearch(item, term)
      return matchesApolloQueueSearch(
        [item.company_name, item.full_name, item.created_at],
        term,
      )
    })
  }

  const sorted = [...filtered].sort((left, right) => compareApolloQueueRows(left, right, parsed.sort))
  const total = sorted.length
  const total_pages = total === 0 ? 0 : Math.ceil(total / parsed.page_size)
  const page = total_pages === 0 ? 1 : Math.min(parsed.page, total_pages)
  const offset = (page - 1) * parsed.page_size
  const pageItems = sorted.slice(offset, offset + parsed.page_size)

  return {
    items: pageItems,
    pagination: {
      page,
      page_size: parsed.page_size,
      total,
      total_pages,
      has_next_page: page < total_pages,
      has_previous_page: page > 1,
      search: parsed.search,
      sort: parsed.sort,
    },
  }
}

export function buildEmptyApolloQueuePagination(
  input?: ApolloQueuePaginationInput,
): ApolloQueuePaginationMeta {
  const parsed = parseApolloQueuePaginationInput(input)
  return {
    page: parsed.page,
    page_size: parsed.page_size,
    total: 0,
    total_pages: 0,
    has_next_page: false,
    has_previous_page: false,
    search: parsed.search,
    sort: parsed.sort,
  }
}

export function parseApolloQueueRequestSearchParams(
  searchParams: URLSearchParams,
): ApolloQueuePaginationInput {
  const pageRaw = searchParams.get("page")
  const pageSizeRaw = searchParams.get("pageSize") ?? searchParams.get("page_size")
  return {
    page: pageRaw ? Number.parseInt(pageRaw, 10) : undefined,
    page_size: pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : undefined,
    search: searchParams.get("search"),
    sort: parseApolloQueueSortKey(searchParams.get("sort")),
  }
}
