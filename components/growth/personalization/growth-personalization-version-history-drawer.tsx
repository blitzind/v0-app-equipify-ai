"use client"

import { useMemo, useState } from "react"
import { Copy, Eye, GitCompare, RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_PERSONALIZATION_VERSION_HISTORY_DRAWER_QA_MARKER,
  type GrowthPersonalizationGenerationVersionEntry,
} from "@/lib/growth/personalization/personalization-generation-ux"
import { personalizationStatusLabel } from "@/lib/growth/personalization/personalization-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral"> = {
  draft: "attention",
  approved: "healthy",
  rejected: "neutral",
  sent: "healthy",
  archived: "neutral",
  blocked: "blocked",
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyLabel: string
  versions: GrowthPersonalizationGenerationVersionEntry[]
  selectedId: string | null
  compareId: string | null
  disabled?: boolean
  onPreview: (generationId: string) => void
  onCompare: (generationId: string) => void
  onUseVersion: (generationId: string) => void
  onRegenerateFrom: (generationId: string) => void
}

function formatVersionWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function GrowthPersonalizationVersionHistoryDrawer({
  open,
  onOpenChange,
  companyLabel,
  versions,
  selectedId,
  compareId,
  disabled = false,
  onPreview,
  onCompare,
  onUseVersion,
  onRegenerateFrom,
}: Props) {
  const [query, setQuery] = useState("")

  const filteredVersions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return versions

    return versions.filter((version) => {
      const haystack = [
        `v${version.versionNumber}`,
        personalizationStatusLabel(version.status),
        version.subject,
        String(version.evidenceCoverageScore),
        String(version.personalizationScore),
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [query, versions])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex h-full max-h-[100dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        data-qa={GROWTH_PERSONALIZATION_VERSION_HISTORY_DRAWER_QA_MARKER}
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 pb-4 pt-6 pr-14">
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>{companyLabel}</SheetDescription>
        </SheetHeader>

        <div className="shrink-0 border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search versions, subject, status…"
              className="pl-9"
              aria-label="Search version history"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!versions.length ? (
            <p className="text-sm text-muted-foreground">No generations yet. Generate a draft to start v1.</p>
          ) : !filteredVersions.length ? (
            <p className="text-sm text-muted-foreground">No versions match your search.</p>
          ) : (
            <ul className="space-y-2">
              {filteredVersions.map((version) => {
                const selected = selectedId === version.id
                const comparing = compareId === version.id

                return (
                  <li key={version.id}>
                    <div
                      className={`rounded-lg border px-3 py-2.5 transition ${
                        selected
                          ? "border-violet-400 bg-violet-50/60 ring-1 ring-violet-200"
                          : "border-border/60 hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            v{version.versionNumber} · {personalizationStatusLabel(version.status)}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {version.subject || "Untitled draft"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Evidence {version.evidenceCoverageScore}%
                            {version.personalizationScore != null
                              ? ` · Quality ${version.personalizationScore}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatVersionWhen(version.createdAt)}
                          </p>
                        </div>
                        <GrowthBadge
                          label={personalizationStatusLabel(version.status)}
                          tone={STATUS_TONE[version.status] ?? "neutral"}
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => onPreview(version.id)}
                          disabled={disabled}
                        >
                          <Eye className="mr-1 size-3" />
                          Preview
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={comparing ? "secondary" : "ghost"}
                          className="h-7 px-2 text-xs"
                          onClick={() => onCompare(version.id)}
                          disabled={disabled}
                        >
                          <GitCompare className="mr-1 size-3" />
                          {comparing ? "Comparing" : "Compare"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            onUseVersion(version.id)
                            onOpenChange(false)
                          }}
                          disabled={disabled}
                        >
                          <Copy className="mr-1 size-3" />
                          Use This Version
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            onRegenerateFrom(version.id)
                            onOpenChange(false)
                          }}
                          disabled={disabled}
                        >
                          <RefreshCw className="mr-1 size-3" />
                          Regenerate From This Version
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
