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
import { GROWTH_COMMAND_JUMP_DESTINATIONS } from "@/lib/growth/command/command-center-navigation"

export function GrowthCommandJumpNav() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            Jump to
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[min(24rem,70vh)] w-52 overflow-y-auto">
          {GROWTH_COMMAND_JUMP_DESTINATIONS.map((destination) => (
            <DropdownMenuItem key={destination.href + destination.label} asChild>
              <Link href={destination.href}>{destination.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-xs text-muted-foreground">Press ⌘K for Growth navigation</p>
    </div>
  )
}
