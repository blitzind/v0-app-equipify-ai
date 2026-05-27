"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export function TitlePillGroup({
  titles,
  onRemove,
  className,
}: {
  titles: string[]
  onRemove: (title: string) => void
  className?: string
}) {
  if (!titles.length) return null

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {titles.map((title) => (
        <span
          key={title}
          className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900"
        >
          {title}
          <button
            type="button"
            aria-label={`Remove ${title}`}
            className="rounded-full p-0.5 hover:bg-violet-200/80"
            onClick={() => onRemove(title)}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  )
}
