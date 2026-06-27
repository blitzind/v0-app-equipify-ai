"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Command,
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
import { resolveGrowthCommandPaletteHref } from "@/lib/growth/navigation/growth-command-palette-derivation"
import {
  GROWTH_COMMAND_PALETTE_ENTRIES,
  GROWTH_NAVIGATION_IA_QA_MARKER,
  growthNavigationShortcutLabel,
} from "@/lib/growth/navigation/growth-navigation-destinations"
import { GROWTH_COMMAND_REGISTRY } from "@/lib/growth/navigation/growth-command-registry"
import {
  GROWTH_NAVIGATION_POLISH_QA_MARKER,
  rankGrowthCommandPaletteEntries,
} from "@/lib/growth/navigation/growth-navigation-ranking"
import {
  readGrowthNavigationUsage,
  recordGrowthNavigationUsage,
  type GrowthNavigationUsageSnapshot,
} from "@/lib/growth/navigation/growth-navigation-usage-memory"

function GrowthCommandPaletteEmptyState({
  usage,
  onSelect,
}: {
  usage: GrowthNavigationUsageSnapshot
  onSelect: (href: string, entry: { id: string; label: string }) => void
}) {
  const recentEntries = usage.recent
    .map((row) => GROWTH_COMMAND_PALETTE_ENTRIES.find((entry) => entry.id === row.id) ?? row)
    .slice(0, 5)

  const suggested = GROWTH_COMMAND_PALETTE_ENTRIES.filter((entry) => entry.coreWorkflow).slice(0, 6)

  return (
    <div className="space-y-4 px-3 py-4 text-sm">
      <p className="text-center text-muted-foreground">No matching destination. Try these instead:</p>

      {recentEntries.length ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent</p>
          <div className="space-y-1">
            {recentEntries.map((entry) => (
              <button
                key={`recent-${entry.id}`}
                type="button"
                className="flex w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
                onClick={() => onSelect(entry.href, { id: entry.id, label: entry.label })}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Suggested destinations
        </p>
        <div className="space-y-1">
          {suggested.map((entry) => (
            <button
              key={`suggested-${entry.id}`}
              type="button"
              className="flex w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
              onClick={() => onSelect(entry.href, { id: entry.id, label: entry.label })}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Core workflow shortcuts
        </p>
        <div className="space-y-1">
          {GROWTH_COMMAND_REGISTRY.slice(0, 4).map((action) => (
            <button
              key={`shortcut-${action.id}`}
              type="button"
              className="flex w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
              onClick={() => onSelect(action.href, { id: action.id, label: action.label })}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function GrowthCommandNavigationPalette() {
  const pathname = usePathname()
  const router = useRouter()
  const { open, setOpen } = useGrowthNavigation()
  const [search, setSearch] = useState("")
  const [usage, setUsage] = useState<GrowthNavigationUsageSnapshot>(() => readGrowthNavigationUsage())

  const shortcut = useMemo(() => growthNavigationShortcutLabel(), [])

  useEffect(() => {
    if (open) {
      setUsage(readGrowthNavigationUsage())
      setSearch("")
    }
  }, [open])

  const navigate = useCallback(
    (href: string, entry: { id: string; label: string }) => {
      const resolvedHref = resolveGrowthCommandPaletteHref(pathname, href)
      setUsage(recordGrowthNavigationUsage({ id: entry.id, href: resolvedHref, label: entry.label }))
      setOpen(false)
      router.push(resolvedHref)
    },
    [pathname, router, setOpen],
  )

  const rankedEntries = useMemo(
    () => rankGrowthCommandPaletteEntries(GROWTH_COMMAND_PALETTE_ENTRIES, search, usage),
    [search, usage],
  )

  const commandEntries = rankedEntries.filter((entry) => entry.group === "command" || entry.group === "quick")
  const navigateEntries = rankedEntries.filter((entry) => entry.group === "navigate")
  const moreEntries = rankedEntries.filter((entry) => entry.group === "more")
  const recentEntries = useMemo(() => {
    if (search.trim()) return []
    return usage.recent
      .map((row) => rankedEntries.find((entry) => entry.id === row.id))
      .filter((entry): entry is (typeof rankedEntries)[number] => Boolean(entry))
      .slice(0, 5)
  }, [search, usage.recent, rankedEntries])

  const hasResults = rankedEntries.length > 0
  const showEmptyState = search.trim().length > 0 && !hasResults

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Growth navigation"
      description="Jump to AI OS destinations and quick actions"
      data-qa-marker={GROWTH_NAVIGATION_IA_QA_MARKER}
      data-navigation-polish-marker={GROWTH_NAVIGATION_POLISH_QA_MARKER}
      commandProps={{ shouldFilter: false }}
    >
      <CommandInput
          placeholder="Search Growth destinations…"
          aria-label="Search Growth destinations"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          {showEmptyState ? (
            <CommandEmpty className="py-0">
              <GrowthCommandPaletteEmptyState
                usage={usage}
                onSelect={(href, entry) => navigate(href, entry)}
              />
            </CommandEmpty>
          ) : (
            <>
              {!search.trim() && recentEntries.length ? (
                <CommandGroup heading="Recent">
                  {recentEntries.map((entry) => (
                    <CommandItem
                      key={`recent-${entry.id}`}
                      value={entry.id}
                      onSelect={() => navigate(entry.href, entry)}
                    >
                      {entry.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {commandEntries.length ? (
                <CommandGroup heading="Commands">
                  {commandEntries.map((entry) => (
                    <CommandItem key={entry.id} value={entry.id} onSelect={() => navigate(entry.href, entry)}>
                      {entry.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {commandEntries.length && navigateEntries.length ? <CommandSeparator /> : null}

              {navigateEntries.length ? (
                <CommandGroup heading="Navigate">
                  {navigateEntries.map((entry) => (
                    <CommandItem key={entry.id} value={entry.id} onSelect={() => navigate(entry.href, entry)}>
                      {entry.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {moreEntries.length ? (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="More">
                    {moreEntries.map((entry) => (
                      <CommandItem key={entry.id} value={entry.id} onSelect={() => navigate(entry.href, entry)}>
                        {entry.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              ) : null}
            </>
          )}
        </CommandList>
      <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
        <CommandShortcut>{shortcut}</CommandShortcut> open · ↑↓ navigate · Enter select · Esc close
      </div>
    </CommandDialog>
  )
}
