"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  ApolloQueuePaginationMeta,
  ApolloQueueSortKey,
} from "@/lib/growth/apollo/apollo-queue-pagination"

export function ApolloQueueControls({
  pagination,
  search,
  sort,
  loading,
  onSearchChange,
  onSortChange,
  onPageChange,
}: {
  pagination: ApolloQueuePaginationMeta | null
  search: string
  sort: ApolloQueueSortKey
  loading?: boolean
  onSearchChange: (value: string) => void
  onSortChange: (value: ApolloQueueSortKey) => void
  onPageChange: (page: number) => void
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search company or contact"
          className="max-w-sm"
          disabled={loading}
        />
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as ApolloQueueSortKey)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          disabled={loading}
        >
          <option value="created_at_desc">Newest first</option>
          <option value="created_at_asc">Oldest first</option>
          <option value="company_name_asc">Company A–Z</option>
          <option value="qualification_score_desc">Qualification score</option>
        </select>
      </div>
      {pagination ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Page {pagination.page} of {Math.max(pagination.total_pages, 1)} · {pagination.total} total
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={loading || !pagination.has_previous_page}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={loading || !pagination.has_next_page}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
