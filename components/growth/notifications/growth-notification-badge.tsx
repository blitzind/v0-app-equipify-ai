"use client"

import { cn } from "@/lib/utils"

export function GrowthNotificationBadge({
  count,
  className,
  compact = false,
}: {
  count?: number
  className?: string
  compact?: boolean
}) {
  if (!count || count <= 0) return null

  const label = count > 99 ? "99+" : String(count)

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-rose-600 font-semibold text-white",
        compact ? "min-w-4 px-1 text-[10px] leading-4" : "min-w-5 px-1.5 text-[11px] leading-5",
        className,
      )}
      aria-label={`${count} unread notifications`}
    >
      {label}
    </span>
  )
}
