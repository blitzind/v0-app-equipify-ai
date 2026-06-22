"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function GrowthActivityFeedSkeleton() {
  return (
    <div className="space-y-2" data-qa="growth-activity-feed-skeleton">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border/70 bg-card p-3">
          <div className="flex gap-3">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-7 w-24" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function GrowthActivityMetricsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, index) => (
        <Skeleton key={index} className="h-20 rounded-lg" />
      ))}
    </div>
  )
}

export function GrowthActivityRailSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}
