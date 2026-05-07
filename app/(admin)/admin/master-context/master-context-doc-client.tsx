"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Copy,
  Database,
  LayoutDashboard,
  RefreshCw,
  Route,
  ScrollText,
} from "lucide-react"
import { toast } from "sonner"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

export type MasterContextScanCounts = {
  apiRouteHandlers: number
  sqlMigrations: number
  dashboardPages: number
  componentsTsx: number
  libTsFiles: number
}

export function MasterContextDocClient({
  initialMarkdown,
  generatedAtIso,
  scanCounts,
  embedded = false,
}: {
  initialMarkdown: string
  generatedAtIso: string
  scanCounts: MasterContextScanCounts
  embedded?: boolean
}) {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  const lastUpdatedLabel = useMemo(() => {
    try {
      const d = new Date(generatedAtIso)
      if (Number.isNaN(d.getTime())) return generatedAtIso
      return `${d.toISOString().replace("T", " ").slice(0, 19)} UTC`
    } catch {
      return generatedAtIso
    }
  }, [generatedAtIso])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(initialMarkdown)
      toast.success("Copied to clipboard", {
        description: "GPT-ready markdown is on your clipboard. Paste it into ChatGPT before implementation prompts.",
        duration: 4500,
      })
    } catch {
      toast.error("Copy failed", {
        description: "Allow clipboard access for this site and try again.",
      })
    }
  }, [initialMarkdown])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    router.refresh()
  }, [router])

  useEffect(() => {
    setRefreshing(false)
  }, [initialMarkdown, generatedAtIso])

  const summaryItems = useMemo(
    () =>
      [
        {
          label: "API routes",
          value: scanCounts.apiRouteHandlers,
          icon: Route,
          hint: "app/api/**/route.ts",
        },
        {
          label: "SQL migrations",
          value: scanCounts.sqlMigrations,
          icon: Database,
          hint: "supabase/migrations",
        },
        {
          label: "Dashboard pages",
          value: scanCounts.dashboardPages,
          icon: LayoutDashboard,
          hint: "app/(dashboard)",
        },
        {
          label: "Last updated",
          value: lastUpdatedLabel,
          icon: Clock,
          hint: "UTC — run pnpm update:master-context",
        },
      ] as const,
    [scanCounts.apiRouteHandlers, scanCounts.dashboardPages, scanCounts.sqlMigrations, lastUpdatedLabel],
  )

  return (
    <div className={cn("bg-background flex flex-col", embedded ? "min-h-0" : "min-h-screen")}>
      {!embedded ? (
        <header className="flex items-center min-h-14 px-4 sm:px-6 py-2 bg-[#0F172A] border-b border-white/10 gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BrandLogo className="h-7 w-auto max-h-7 shrink-0" priority />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-200 border border-violet-400/25 truncate">
            Master Context Doc
          </span>
        </div>
        <div className="flex-1 min-w-[1rem]" />
        <Link
          href="/admin"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft size={14} />
          Platform Admin
        </Link>
        <Link
          href="/admin/ai-operations"
          className="hidden sm:inline-flex text-xs text-slate-400 hover:text-white transition-colors shrink-0"
        >
          AI Operations
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors shrink-0"
        >
          App <ChevronRight size={12} />
        </Link>
        </header>
      ) : null}

      {/* Sticky action bar */}
      <div
        className={cn(
          embedded ? "border-b border-border" : "sticky top-0 z-20 border-b border-border",
          "bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85",
          "dark:bg-background/90 dark:supports-[backdrop-filter]:dark:bg-background/75",
          "shadow-[0_1px_0_0_oklch(var(--border)_/_0.6)]",
        )}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground hidden sm:block max-w-[min(100%,28rem)] leading-snug">
            Quick actions — stays visible while you scroll the document.
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto w-full sm:w-auto justify-end">
            <Button
              type="button"
              size="sm"
              className="bg-[#f59f1c] text-[#1a150a] hover:bg-[#e08e0e] border-0 font-semibold min-h-10 px-4"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4 mr-2 shrink-0" />
              Copy context
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-10 border-border bg-background hover:bg-muted/80 dark:hover:bg-muted/50"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2 shrink-0", refreshing && "animate-spin")} />
              Refresh context
            </Button>
          </div>
        </div>
      </div>

      <main className={cn("flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-10", embedded && "max-w-none px-0 sm:px-0 py-0")}>
        <section className="space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <ScrollText className="h-7 w-7 text-primary shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-2 min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  Equipify Master Context Doc
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  This document is intended to be pasted into GPT before requesting implementation prompts.
                </p>
              </div>
            </div>

            <div
              className={cn(
                "rounded-xl border border-border px-4 py-3 sm:px-5 sm:py-4",
                "bg-muted/35 dark:bg-muted/25",
                "text-sm text-foreground/90 leading-relaxed",
              )}
            >
              <p className="font-medium text-foreground mb-1">Internal use only</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Copy/paste the markdown below into ChatGPT or your GPT project context. Do not include secrets,
                credentials, or customer data. After meaningful commits, run{" "}
                <code className="rounded-md bg-background/80 dark:bg-background/50 px-1.5 py-0.5 text-[13px] border border-border">
                  pnpm update:master-context
                </code>{" "}
                from the app root to refresh the repository scan, then use Refresh context here.
              </p>
            </div>
          </div>
        </section>

        {/* Compact summary */}
        <section aria-labelledby="mc-stats-heading">
          <h2 id="mc-stats-heading" className="sr-only">
            Repository scan summary
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {summaryItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-xl border border-border p-3 sm:p-4",
                    "bg-card text-card-foreground shadow-sm",
                    "dark:bg-card dark:border-border/80",
                  )}
                >
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    <Icon className="h-3.5 w-3.5 opacity-80 shrink-0" aria-hidden />
                    {item.label}
                  </div>
                  <p
                    className={cn(
                      "mt-2 font-semibold text-foreground",
                      typeof item.value === "string"
                        ? "text-sm sm:text-base font-mono break-all leading-snug"
                        : "text-2xl sm:text-3xl tabular-nums",
                    )}
                  >
                    {item.value}
                  </p>
                  <p className="mt-1.5 text-[11px] sm:text-xs text-muted-foreground leading-snug">{item.hint}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Document */}
        <section className="space-y-3 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground">Full markdown document</h2>
            <span className="text-xs text-muted-foreground">Monospace · scroll to review before copying</span>
          </div>
          <div
            className={cn(
              "rounded-xl border border-border overflow-hidden flex flex-col flex-1 min-h-[min(65vh,680px)]",
              "bg-card shadow-sm dark:shadow-none",
              "ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
            )}
          >
            <div className="px-3 sm:px-4 py-2 border-b border-border bg-muted/40 dark:bg-muted/25 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">context.md</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                {scanCounts.componentsTsx} components · {scanCounts.libTsFiles} lib files
              </span>
            </div>
            <Textarea
              readOnly
              value={initialMarkdown}
              spellCheck={false}
              className={cn(
                "flex-1 min-h-[min(55vh,600px)] rounded-none border-0 resize-y",
                "font-mono text-[13px] sm:text-sm leading-6 sm:leading-7",
                "p-4 sm:p-5",
                "bg-muted/20 dark:bg-muted/15",
                "text-foreground",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                "selection:bg-primary/20",
              )}
              aria-label="Full master context markdown"
            />
          </div>
        </section>
      </main>

      {!embedded ? <Toaster richColors position="top-center" closeButton className="z-[100]" /> : null}
    </div>
  )
}
