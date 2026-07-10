"use client"

import { useMemo, useState, type Dispatch, SetStateAction } from "react"
import { X } from "lucide-react"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  lookupIndustryCodeLabel,
  resolveIndustryCodesFromQuery,
  validateIndustryCode,
  type IndustryCodeKind,
} from "@/lib/growth/prospect-search/prospect-search-industry-code-filters"
import { cn } from "@/lib/utils"

type CodeChip = {
  code: string
  kind: IndustryCodeKind
  label: string
  mode: "include" | "exclude"
}

function parseCodes(
  include: string[] | undefined,
  exclude: string[] | undefined,
  kind: IndustryCodeKind,
): CodeChip[] {
  const chips: CodeChip[] = []
  for (const code of include ?? []) {
    const validation = validateIndustryCode(code, kind)
    chips.push({
      code: validation.ok ? validation.code : code,
      kind,
      label: validation.ok ? validation.label : code,
      mode: "include",
    })
  }
  for (const code of exclude ?? []) {
    const validation = validateIndustryCode(code, kind)
    chips.push({
      code: validation.ok ? validation.code : code,
      kind,
      label: validation.ok ? validation.label : code,
      mode: "exclude",
    })
  }
  return chips
}

function applyChipChange(
  filters: GrowthProspectSearchFilters,
  chips: CodeChip[],
): GrowthProspectSearchFilters {
  const naicsInclude = chips.filter((c) => c.kind === "naics" && c.mode === "include").map((c) => c.code)
  const naicsExclude = chips.filter((c) => c.kind === "naics" && c.mode === "exclude").map((c) => c.code)
  const sicInclude = chips.filter((c) => c.kind === "sic" && c.mode === "include").map((c) => c.code)
  const sicExclude = chips.filter((c) => c.kind === "sic" && c.mode === "exclude").map((c) => c.code)
  return {
    ...filters,
    naics_codes: naicsInclude.length ? naicsInclude : undefined,
    excluded_naics_codes: naicsExclude.length ? naicsExclude : undefined,
    sic_codes: sicInclude.length ? sicInclude : undefined,
    excluded_sic_codes: sicExclude.length ? sicExclude : undefined,
  }
}

export function IndustryCodeFilterCard({
  filters,
  onChange,
}: {
  filters: GrowthProspectSearchFilters
  onChange: Dispatch<SetStateAction<GrowthProspectSearchFilters>>
}) {
  const [input, setInput] = useState("")
  const [kind, setKind] = useState<IndustryCodeKind>("naics")
  const [mode, setMode] = useState<"include" | "exclude">("include")
  const [error, setError] = useState<string | null>(null)

  const chips = useMemo(
    () =>
      parseCodes(filters.naics_codes, filters.excluded_naics_codes, "naics").concat(
        parseCodes(filters.sic_codes, filters.excluded_sic_codes, "sic"),
      ),
    [filters],
  )

  const suggestions = useMemo(() => resolveIndustryCodesFromQuery(input), [input])

  function addCode(raw: string, nextKind = kind, nextMode = mode) {
    const validation = validateIndustryCode(raw, nextKind)
    if (!validation.ok) {
      setError(
        validation.reason === "invalid_format"
          ? `Invalid ${nextKind.toUpperCase()} format`
          : `${nextKind.toUpperCase()} ${validation.code} is not in the supported taxonomy set`,
      )
      return
    }
    setError(null)
    onChange((prev) => {
      const nextChips = chips.filter(
        (c) => !(c.code === validation.code && c.kind === validation.kind && c.mode === nextMode),
      )
      nextChips.push({
        code: validation.code,
        kind: validation.kind,
        label: validation.label,
        mode: nextMode,
      })
      return applyChipChange(prev, nextChips)
    })
    setInput("")
  }

  function removeChip(chip: CodeChip) {
    onChange((prev) =>
      applyChipChange(
        prev,
        chips.filter(
          (c) => !(c.code === chip.code && c.kind === chip.kind && c.mode === chip.mode),
        ),
      ),
    )
  }

  return (
    <div className="space-y-2" data-industry-code-filters="v1">
      <p className="text-xs text-muted-foreground">
        NAICS/SIC codes are search filters and evidence signals — GE-AIOS-21C still evaluates every lead.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(["naics", "sic"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium",
              kind === k ? "border-primary bg-primary/10 text-primary" : "border-border",
            )}
          >
            {k.toUpperCase()}
          </button>
        ))}
        {(["include", "exclude"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
              mode === m ? "border-violet-400 bg-violet-50 text-violet-900" : "border-border",
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addCode(input)
            }
          }}
          placeholder={kind === "naics" ? "811310 or biomedical repair" : "7372 or software"}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={() => addCode(input)}
          className="rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Add
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {suggestions.length > 0 && input.trim().length >= 3 ? (
        <ul className="space-y-1 rounded-md border border-dashed border-border/80 p-2">
          {suggestions.slice(0, 5).map((s) => (
            <li key={`${s.kind}-${s.code}`}>
              <button
                type="button"
                className="w-full text-left text-xs hover:text-primary"
                onClick={() => addCode(s.code, s.kind, mode)}
              >
                {s.kind.toUpperCase()} {s.code} — {s.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={`${chip.mode}-${chip.kind}-${chip.code}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                chip.mode === "exclude"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900",
              )}
              title={lookupIndustryCodeLabel(chip.code, chip.kind) ?? chip.label}
            >
              {chip.mode === "exclude" ? "−" : "+"} {chip.kind.toUpperCase()} {chip.code} — {chip.label}
              <button type="button" onClick={() => removeChip(chip)} aria-label="Remove code">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
