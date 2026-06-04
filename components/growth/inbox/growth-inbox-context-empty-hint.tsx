"use client"

import { cn } from "@/lib/utils"

type GrowthInboxContextEmptyHintProps = {
  label: string
  className?: string
}

/** Compact inline indicator for sparse lead context — avoids large empty cards. */
export function GrowthInboxContextEmptyHint({ label, className }: GrowthInboxContextEmptyHintProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border border-dashed border-border/50 bg-muted/10 px-2 py-0.5 text-[10px] leading-none text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  )
}
