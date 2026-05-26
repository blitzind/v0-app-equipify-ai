"use client"

import { Badge } from "@/components/ui/badge"
import { formatLabel, priorityTone } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
import { cn } from "@/lib/utils"

export function LeadPriorityCard({
  priority,
  urgency,
}: {
  priority: string
  urgency: string
}) {
  const tone = priorityTone(priority)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={tone.badge} className={cn("capitalize", tone.className)}>
        {formatLabel(priority)} priority
      </Badge>
      <Badge variant="outline" className="capitalize">
        {formatLabel(urgency)} urgency
      </Badge>
    </div>
  )
}
