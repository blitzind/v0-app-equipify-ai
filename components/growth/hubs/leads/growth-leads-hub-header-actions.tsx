"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  GROWTH_LEADS_HUB_CREATE_ACTIONS,
  GROWTH_LEADS_HUB_KEYBOARD_HINTS,
} from "@/lib/growth/hubs/growth-leads-hub-config"
import { GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { recordGrowthLeadsActivity } from "@/lib/growth/hubs/growth-leads-recent-work-memory"

export function GrowthLeadsHubHeaderActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="hidden items-center gap-3 text-xs text-muted-foreground xl:flex"
        aria-label="Keyboard shortcut hints"
        data-section="keyboard-hints"
      >
        {GROWTH_LEADS_HUB_KEYBOARD_HINTS.map((hint) => (
          <span key={hint.id} className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
              {hint.keys}
            </kbd>
            {hint.label}
          </span>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" aria-label="Create new item in leads workspace">
            <Plus className="mr-1 size-4" aria-hidden />
            New
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2">
          <ul className="space-y-0.5">
            {GROWTH_LEADS_HUB_CREATE_ACTIONS.map((action) => (
              <li key={action.id}>
                <Link
                  href={action.href}
                  onClick={() =>
                    recordGrowthLeadsActivity({
                      id: `create:${action.id}`,
                      verb: "Opened",
                      label: action.label,
                      href: action.href,
                    })
                  }
                  className="flex w-full rounded-md px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  data-create-action={action.id}
                >
                  {action.label}
                </Link>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <Link
        href={GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF}
        className="sr-only focus:not-sr-only focus:rounded focus:outline-none focus:ring-2 focus:ring-primary"
        data-keyboard-hint-target="G"
      >
        Prospect Search
      </Link>
    </div>
  )
}
