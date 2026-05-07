"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronRight, Copy, RefreshCw, ScrollText } from "lucide-react"
import { toast } from "sonner"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

export function MasterContextDocClient({
  initialMarkdown,
  generatedAtIso,
}: {
  initialMarkdown: string
  generatedAtIso: string
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
      toast.success("Copied to clipboard — paste into ChatGPT or your project context.")
    } catch {
      toast.error("Copy failed — allow clipboard access and try again.")
    }
  }, [initialMarkdown])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    router.refresh()
  }, [router])

  useEffect(() => {
    setRefreshing(false)
  }, [initialMarkdown, generatedAtIso])

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center min-h-14 px-6 py-2 bg-[#0F172A] border-b border-white/10 gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <BrandLogo className="h-7 w-auto max-h-7" priority />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-200 border border-violet-400/25">
            Master Context Doc
          </span>
        </div>
        <div className="flex-1" />
        <Link
          href="/admin"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Platform Admin
        </Link>
        <Link
          href="/admin/ai-operations"
          className="hidden sm:inline-flex text-xs text-slate-400 hover:text-white transition-colors"
        >
          AI Operations
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          App <ChevronRight size={12} />
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ScrollText className="h-6 w-6 text-violet-500" />
            <h1 className="text-xl font-semibold text-foreground">Equipify Master Context Doc</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Copy/paste this into GPT before requesting implementation prompts. This document is internal and must not
            include secrets or customer data.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Last updated (UTC):</span> {lastUpdatedLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              After each meaningful commit, run{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">pnpm update:master-context</code> from the
              app root to refresh the auto-generated repository scan, then rebuild or refresh this page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="bg-[#f59f1c] text-[#1a150a] hover:bg-[#e08e0e] border-0"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copy context
            </Button>
            <Button type="button" variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-1.5", refreshing && "animate-spin")} />
              Refresh context
            </Button>
          </div>
        </div>

        <Textarea
          readOnly
          value={initialMarkdown}
          spellCheck={false}
          className="min-h-[min(70vh,720px)] font-mono text-xs leading-relaxed resize-y"
          aria-label="Master context markdown"
        />
      </div>

      <Toaster richColors />
    </div>
  )
}
