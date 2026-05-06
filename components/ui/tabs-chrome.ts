import { cn } from "@/lib/utils"

/** Dark-mode Equipify blue tab “pill” — matches nav / insights emphasis language */
export const TAB_ACTIVE_PANEL_DARK =
  "dark:bg-[#13233F] dark:border-[#296cff]/30 dark:text-[#6EA8FF] dark:shadow-[0_0_20px_-8px_rgba(41,108,255,0.45)]"

export const TAB_HOVER_INACTIVE_DARK = "dark:hover:bg-[#13233F]/28 dark:hover:text-foreground"

/** Radix `TabsList`: drawer/detail horizontal tab strip (scroll, bottom border) */
export const tabsListDrawerRowClassName = cn(
  "h-auto min-h-0 w-full flex flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain justify-start gap-1 rounded-none border-0 border-b border-border dark:border-[#25324C] p-0 shrink-0 z-[11] px-5 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
)

/** Radix `TabsTrigger`: drawer / detail row tabs (replaces gray underline) */
export function tabsTriggerDrawerRowClassName(extra?: string) {
  return cn(
    "grow-0 basis-auto rounded-md border border-transparent px-3 py-2.5 shadow-none outline-none",
    "text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150",
    "text-muted-foreground hover:text-foreground",
    TAB_HOVER_INACTIVE_DARK,
    // Light
    "data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm",
    // Dark
    TAB_ACTIVE_PANEL_DARK,
    "dark:data-[state=active]:hover:bg-[#172d50]",
    extra,
  )
}

/**
 * Custom `<button>` tabs (equipment / technician / invoice drawers) — same visual language as `tabsTriggerDrawerRowClassName`.
 */
export function cnDrawerTabButton(isActive: boolean, className?: string) {
  return cn(
    "flex items-center gap-1.5 rounded-md border px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all duration-150 shrink-0 border-transparent cursor-pointer",
    isActive
      ? cn(
          "border-border bg-background text-primary shadow-sm",
          TAB_ACTIVE_PANEL_DARK,
          "dark:hover:bg-[#172d50]",
        )
      : cn("text-muted-foreground hover:text-foreground", TAB_HOVER_INACTIVE_DARK),
    className,
  )
}
