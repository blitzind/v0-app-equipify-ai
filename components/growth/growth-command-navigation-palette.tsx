"use client"

import { useRouter } from "next/navigation"
import { useMemo } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useGrowthNavigation } from "@/components/growth/growth-navigation-provider"
import {
  GROWTH_COMMAND_PALETTE_DESTINATIONS,
  GROWTH_NAVIGATION_IA_QA_MARKER,
  GROWTH_NAV_QUICK_ACTIONS,
  GROWTH_NAV_QUICK_ACTIONS_SECONDARY,
  growthNavigationShortcutLabel,
} from "@/lib/growth/navigation/growth-navigation-destinations"

export function GrowthCommandNavigationPalette() {
  const router = useRouter()
  const { open, setOpen } = useGrowthNavigation()

  const shortcut = useMemo(() => growthNavigationShortcutLabel(), [])

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Growth navigation"
      description="Jump to Growth Engine destinations and quick actions"
      data-qa-marker={GROWTH_NAVIGATION_IA_QA_MARKER}
    >
      <CommandInput placeholder="Search Growth destinations…" aria-label="Search Growth destinations" />
      <CommandList>
        <CommandEmpty>No matching destination.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          {GROWTH_NAV_QUICK_ACTIONS.map((action) => (
            <CommandItem
              key={action.id}
              value={[action.label, ...(action.keywords ?? [])].join(" ")}
              onSelect={() => navigate(action.href)}
            >
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {GROWTH_COMMAND_PALETTE_DESTINATIONS.map((dest) => (
            <CommandItem
              key={dest.id}
              value={[dest.label, ...(dest.keywords ?? [])].join(" ")}
              onSelect={() => navigate(dest.href)}
            >
              {dest.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {GROWTH_NAV_QUICK_ACTIONS_SECONDARY.length ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="More">
              {GROWTH_NAV_QUICK_ACTIONS_SECONDARY.map((action) => (
                <CommandItem
                  key={action.id}
                  value={[action.label, ...(action.keywords ?? [])].join(" ")}
                  onSelect={() => navigate(action.href)}
                >
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
      <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
        <span className="mr-3">{GROWTH_NAVIGATION_IA_QA_MARKER}</span>
        <CommandShortcut>{shortcut}</CommandShortcut> open · ↑↓ navigate · Enter select · Esc close
      </div>
    </CommandDialog>
  )
}
