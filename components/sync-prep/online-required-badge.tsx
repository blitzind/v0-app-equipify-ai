"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ONLINE_REQUIRED_LABEL, SYNC_PREP_COPY } from "@/lib/sync-prep"

export function OnlineRequiredBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-semibold border-amber-500/35 text-amber-900 dark:text-amber-100 cursor-help shrink-0",
            className,
          )}
        >
          {ONLINE_REQUIRED_LABEL}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {SYNC_PREP_COPY.onlineRequiredTooltip}
      </TooltipContent>
    </Tooltip>
  )
}
