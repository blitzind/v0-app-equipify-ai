"use client"

import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useGrowthNavigation } from "@/components/growth/growth-navigation-provider"
import { GROWTH_COMMAND_JUMP_DESTINATIONS } from "@/lib/growth/command/command-center-navigation"
import {
  GROWTH_COMMAND_PALETTE_DESTINATIONS,
  growthNavigationShortcutLabel,
} from "@/lib/growth/navigation/growth-navigation-destinations"

export function GrowthCommandJumpNav() {
  const { setOpen } = useGrowthNavigation()
  const shortcut = growthNavigationShortcutLabel()

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Open navigation
        <span className="ml-1.5 text-[10px] text-muted-foreground">{shortcut}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            Jump to
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[min(24rem,70vh)] w-52 overflow-y-auto">
          {GROWTH_COMMAND_PALETTE_DESTINATIONS.map((destination) => (
            <DropdownMenuItem key={destination.id} asChild>
              <Link href={destination.href}>{destination.label}</Link>
            </DropdownMenuItem>
          ))}
          {GROWTH_COMMAND_JUMP_DESTINATIONS.filter(
            (dest) => !GROWTH_COMMAND_PALETTE_DESTINATIONS.some((d) => d.href === dest.href),
          ).map((destination) => (
            <DropdownMenuItem key={destination.href + destination.label} asChild>
              <Link href={destination.href}>{destination.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-xs text-muted-foreground">
        Press {shortcut} for Growth navigation
      </p>
    </div>
  )
}
