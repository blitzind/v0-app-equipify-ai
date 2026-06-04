"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronsUpDown, Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { EmailDiscoveryRolePairRow } from "@/lib/growth/email-discovery/email-discovery-role-pairs"
import { cn } from "@/lib/utils"

type GrowthEmailDiscoveryRolePickerProps = {
  pairs: EmailDiscoveryRolePairRow[]
  loading: boolean
  loadError: string | null
  selected: EmailDiscoveryRolePairRow | null
  onSelect: (row: EmailDiscoveryRolePairRow | null) => void
}

function pairLabel(row: EmailDiscoveryRolePairRow): string {
  const title = row.title ? ` · ${row.title}` : ""
  const domain = row.domain ? ` · ${row.domain}` : ""
  return `${row.person_name} @ ${row.company_name}${title}${domain}`
}

export function GrowthEmailDiscoveryRolePicker({
  pairs,
  loading,
  loadError,
  selected,
  onSelect,
}: GrowthEmailDiscoveryRolePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return pairs
    return pairs.filter((row) => pairLabel(row).toLowerCase().includes(needle))
  }, [pairs, search])

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  return (
    <div className="space-y-2">
      <Label>Company / person role</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between py-2 font-normal"
            disabled={loading}
          >
            <span className="flex min-w-0 items-start gap-2 text-left">
              {loading ? (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0">
                {selected ? (
                  <>
                    <span className="block truncate font-medium">{pairLabel(selected)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {selected.company_id} · {selected.person_id}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {loading ? "Loading roles…" : "Search company / person pairs…"}
                  </span>
                )}
              </span>
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search name, title, domain…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {pairs.length === 0
                  ? "No person_company_roles rows found. Run canonical person backfill first."
                  : "No matching roles."}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((row) => {
                  const isSelected =
                    selected?.company_id === row.company_id && selected?.person_id === row.person_id
                  return (
                    <CommandItem
                      key={row.role_id}
                      value={row.role_id}
                      onSelect={() => {
                        onSelect(row)
                        setOpen(false)
                      }}
                    >
                      <Check className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{row.person_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.company_name}
                          {row.title ? ` · ${row.title}` : ""}
                          {row.domain ? ` · ${row.domain}` : ""}
                        </p>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}
      {!loading && !loadError && pairs.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {pairs.length} role{pairs.length === 1 ? "" : "s"} from growth.person_company_roles
        </p>
      ) : null}
    </div>
  )
}
