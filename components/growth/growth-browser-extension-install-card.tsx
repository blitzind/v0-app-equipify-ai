"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Chrome, ChevronDown, ChevronUp, Download, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_BROWSER_EXTENSION_DIR,
  GROWTH_BROWSER_EXTENSION_DOWNLOAD_PATH,
  GROWTH_BROWSER_EXTENSION_INSTALL_STEPS,
  GROWTH_BROWSER_EXTENSION_QA_MARKER,
} from "@/lib/growth/browser-intake/extension-install-types"
import {
  formatGrowthBrowserExtensionPackageMetadata,
  GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_DOWNLOAD_PATH,
  type GrowthBrowserExtensionPackageMetadata,
} from "@/lib/growth/browser-intake/extension-package-metadata-types"
import { cn } from "@/lib/utils"

type GrowthBrowserExtensionInstallCardProps = {
  className?: string
  compact?: boolean
}

export function GrowthBrowserExtensionInstallCard({
  className,
  compact = false,
}: GrowthBrowserExtensionInstallCardProps) {
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [zipAvailable, setZipAvailable] = useState<boolean | null>(null)
  const [packageMetadata, setPackageMetadata] = useState<GrowthBrowserExtensionPackageMetadata | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false

    void fetch(GROWTH_BROWSER_EXTENSION_DOWNLOAD_PATH, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setZipAvailable(res.ok)
      })
      .catch(() => {
        if (!cancelled) setZipAvailable(false)
      })

    void fetch(GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_DOWNLOAD_PATH)
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as GrowthBrowserExtensionPackageMetadata
      })
      .then((metadata) => {
        if (!cancelled && metadata?.extension_version && metadata.generated_at) {
          setPackageMetadata(metadata)
        }
      })
      .catch(() => {
        if (!cancelled) setPackageMetadata(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 dark:ring-[#25324C]/80",
        className,
      )}
      data-qa-marker={GROWTH_BROWSER_EXTENSION_QA_MARKER}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
          <Chrome size={17} />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Chrome Extension</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Capture contacts from websites and LinkedIn into Growth Engine using visible page metadata only.
              Uses your existing Equipify admin session — no API keys stored in the extension.
            </p>
          </div>

          {packageMetadata ? (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Download package:</span>{" "}
              {formatGrowthBrowserExtensionPackageMetadata(packageMetadata)}
            </div>
          ) : null}

          {!compact ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Local install path:</span>{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {GROWTH_BROWSER_EXTENSION_DIR}
              </code>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInstructionsOpen((open) => !open)}
            >
              <FileText className="mr-2 size-4" />
              View install instructions
              {instructionsOpen ? (
                <ChevronUp className="ml-2 size-4" />
              ) : (
                <ChevronDown className="ml-2 size-4" />
              )}
            </Button>

            {zipAvailable ? (
              <Button asChild size="sm">
                <a href={GROWTH_BROWSER_EXTENSION_DOWNLOAD_PATH} download>
                  <Download className="mr-2 size-4" />
                  Download ZIP
                </a>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="secondary" disabled={zipAvailable === null}>
                <Download className="mr-2 size-4" />
                {zipAvailable === null ? "Checking ZIP…" : "ZIP not packaged yet"}
              </Button>
            )}

            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/growth/browser-intake-test">Open intake test</Link>
            </Button>
          </div>

          {zipAvailable === false ? (
            <p className="text-xs text-muted-foreground">
              Run <code className="rounded bg-muted px-1 py-0.5 font-mono">pnpm package:growth-extension</code> to
              create <code className="rounded bg-muted px-1 py-0.5 font-mono">public/downloads/growth-browser-intake.zip</code>.
            </p>
          ) : null}

          {instructionsOpen ? (
            <ol className="list-decimal space-y-2 border-t border-border/60 pt-3 pl-5 text-sm text-muted-foreground">
              {GROWTH_BROWSER_EXTENSION_INSTALL_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </section>
  )
}
